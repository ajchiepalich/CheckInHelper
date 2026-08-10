import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEnv, isEntraConfigured, isLocalAuthEnabled } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
    };
  }

  interface User {
    role: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}

const DEFAULT_USER_EMAIL = "guest@highlands.local";

function buildProviders() {
  const env = getEnv();
  const providers = [];

  if (isEntraConfigured()) {
    providers.push(
      MicrosoftEntraID({
        clientId: env.ENTRA_CLIENT_ID!,
        clientSecret: env.ENTRA_CLIENT_SECRET!,
        issuer: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`,
      }),
    );
  }

  if (isLocalAuthEnabled()) {
    providers.push(
      Credentials({
        id: "local-dev",
        name: "Local Development",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email?.toString().toLowerCase().trim();
          if (!email) return null;

          const allowed = ["admin@highlands.local", "staff@highlands.local"];
          if (!allowed.includes(email)) return null;

          const role = email.startsWith("admin")
            ? UserRole.ADMIN
            : UserRole.STAFF;

          const user = await prisma.user.upsert({
            where: { email },
            update: { role },
            create: {
              email,
              name: role === UserRole.ADMIN ? "Local Admin" : "Local Staff",
              role,
            },
          });

          return user;
        },
      }),
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: buildProviders(),
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      } else if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? UserRole.STAFF;
      }
      return session;
    },
  },
});

export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role: UserRole;
  };
};

async function getDefaultUser() {
  return prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: { role: UserRole.ADMIN },
    create: {
      email: DEFAULT_USER_EMAIL,
      name: "Guest User",
      role: UserRole.ADMIN,
    },
  });
}

export async function requireAuth(): Promise<AppSession> {
  const user = await getDefaultUser();
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    },
  };
}

export async function requireAdmin(): Promise<AppSession> {
  return requireAuth();
}

export async function getOptionalSession(): Promise<AppSession> {
  return requireAuth();
}
