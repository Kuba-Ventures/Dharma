// Wraps @auth/prisma-adapter to make Account linking idempotent.
//
// The stock adapter creates a new Account row on every link. That breaks when
// the User already has an Account row for the same provider but with a stale
// providerAccountId (Google rotated `sub`, OAuth client changed, etc.) —
// NextAuth's email-based fallback kicks in but the unique constraint
// (provider, providerAccountId) creates a second row instead of healing the
// existing one. Worse, certain race conditions throw OAuthAccountNotLinked.
//
// This wrapper makes linkAccount upsert-by-(userId, provider): if a row
// already exists, it's updated with the new providerAccountId + fresh tokens.
// Effectively: "every successful OAuth sign-in re-anchors the link record."

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";

export function makeResilientAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    async linkAccount(account: AdapterAccount): Promise<void> {
      const existing = await prisma.account.findFirst({
        where: { userId: account.userId, provider: account.provider },
      });

      if (existing) {
        await prisma.account.update({
          where: { id: existing.id },
          data: {
            type: account.type,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token ?? null,
            access_token: account.access_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state:
              typeof account.session_state === "string"
                ? account.session_state
                : null,
          },
        });
        return;
      }

      // No existing row — delegate to the base adapter's create.
      if (!base.linkAccount) {
        throw new Error("Base adapter missing linkAccount");
      }
      await base.linkAccount(account);
    },
  };
}
