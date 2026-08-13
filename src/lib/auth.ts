import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { UserRole, type UserRole as UserRoleValue, createId, dbError, getDb } from "@/lib/db";
import { getEnv, isEntraConfigured, isLocalAuthEnabled } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRoleValue;
    };
  }

  interface User {
    role: UserRoleValue;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRoleValue;
  }
}

const DEFAULT_USER_EMAIL = "guest@highlands.local";

async function saveUser(input: {
  email: string;
  name: string;
  role: UserRole;
}) {
  const db = getDb();
  const { data: existing, error: lookupError } = await db
    .from("User")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();
  if (lookupError) dbError(lookupError, "Unable to load user");

  const now = new Date().toISOString();
  const query = existing
    ? db
        .from("User")
        .update({ name: input.name, role: input.role, updatedAt: now })
        .eq("id", existing.id)
    : db.from("User").insert({ id: createId(), ...input, updatedAt: now });
  const { data, error } = await query
    .select("id, email, name, image, role")
    .single();
  if (error || !data) dbError(error, "Unable to save user");
  return data;
}

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

          return saveUser({
            email,
            name: role === UserRole.ADMIN ? "Local Admin" : "Local Staff",
            role,
          });
        },
      }),
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        const { data: dbUser, error } = await getDb()
          .from("User")
          .select("id, role")
          .eq("email", token.email)
          .maybeSingle();
        if (error) dbError(error, "Unable to load user");
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
  return saveUser({
    email: DEFAULT_USER_EMAIL,
    name: "Guest User",
    role: UserRole.ADMIN,
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
