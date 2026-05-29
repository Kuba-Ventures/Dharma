import NextAuth from "next-auth";
import { waitUntil } from "@vercel/functions";
import Google from "next-auth/providers/google";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { makeResilientAdapter } from "./adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    error(code, ...message) { console.error("[nextauth error]", code, JSON.stringify(message)); },
    warn(code) { console.warn("[nextauth warn]", code); },
  },
  adapter: makeResilientAdapter(prisma),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
          access_type: "offline",
          // "consent" keeps refresh tokens coming back on re-auth.
          // "select_account" forces Google's account picker every sign-in
          // so Chrome can't silently pick the wrong account when you're
          // signed into multiple Google accounts.
          prompt: "consent select_account",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Defensive guard against Account-row corruption: Auth.js resolves the
      // signing-in User by looking up Account.providerAccountId first. If a
      // stale or wrong Account row points the resolved User at a different
      // email than Google just returned, we abort.
      if (
        account?.provider === "google" &&
        profile?.email &&
        user?.email &&
        user.email.toLowerCase() !== profile.email.toLowerCase()
      ) {
        console.warn(
          "[auth] Rejecting OAuth sign-in: resolved user",
          user.email,
          "≠ OAuth profile",
          profile.email,
          "— probable Account row corruption",
        );
        return false;
      }

      // Guard against Auth.js's JWT-carryover bug: if a stale session cookie
      // is present for a *different* user than the one Google just
      // authenticated, the upstream handler in @auth/core silently links the
      // new OAuth grant to the JWT's user instead of the email Google
      // returned. We detect that here and abort.
      if (account?.provider === "google" && profile?.email) {
        try {
          const jar = await cookies();
          const cookieName =
            process.env.NODE_ENV === "production"
              ? "__Secure-authjs.session-token"
              : "authjs.session-token";
          const raw = jar.get(cookieName)?.value ?? jar.get("authjs.session-token")?.value;
          if (raw) {
            const decoded = await decode({
              token: raw,
              secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET!,
              salt: cookieName,
            });
            const existingEmail = (decoded as { email?: string } | null)?.email;
            if (
              existingEmail &&
              existingEmail.toLowerCase() !== profile.email.toLowerCase()
            ) {
              console.warn(
                "[auth] Rejecting OAuth sign-in: stale JWT user",
                existingEmail,
                "≠ OAuth profile",
                profile.email,
              );
              return false;
            }
          }
        } catch (err) {
          console.error("[auth] JWT carryover check failed:", err);
        }
      }

      if (account?.provider === "google" && user.id && user.email && account.access_token) {
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000)
          : new Date(Date.now() + 3600 * 1000);

        try {
          await prisma.googleCredential.upsert({
            where: { userId: user.id },
            update: {
              accessToken: account.access_token,
              ...(account.refresh_token && { refreshToken: account.refresh_token }),
              expiresAt,
            },
            create: {
              userId: user.id,
              email: user.email,
              accessToken: account.access_token,
              refreshToken: account.refresh_token ?? "",
              expiresAt,
            },
          });
        } catch (err) {
          console.error("[auth] Failed to upsert GoogleCredential:", err);
        }

        const token = account.access_token;
        const refresh = account.refresh_token ?? "";
        const uid = user.id;
        try {
          waitUntil(
            import("./gmail")
              .then(({ setupGmailWatch }) => setupGmailWatch(uid, token, refresh))
              .catch((err) => console.error("[auth] Gmail watch setup failed:", err))
          );
        } catch (err) {
          console.error("[auth] waitUntil not available, skipping Gmail watch setup:", err);
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
