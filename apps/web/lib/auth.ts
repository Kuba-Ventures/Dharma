import NextAuth from "next-auth";
import { waitUntil } from "@vercel/functions";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    error(code, ...message) { console.error("[nextauth error]", code, JSON.stringify(message)); },
    warn(code) { console.warn("[nextauth warn]", code); },
  },
  adapter: PrismaAdapter(prisma),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
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
