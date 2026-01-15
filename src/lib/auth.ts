import NextAuth, { NextAuthOptions, DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

// Extend session types to include role
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: string;
            isActive: boolean;
        } & DefaultSession["user"];
    }

    interface User {
        role?: string;
        isActive?: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        isActive?: boolean;
    }
}

// Super admin email - always has access
const SUPER_ADMIN_EMAIL = "shaktimotani@gmail.com";

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as any,
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user }) {
            if (!user.email) return false;

            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { email: user.email },
            });

            // Super admin always allowed
            if (user.email === SUPER_ADMIN_EMAIL) {
                if (!existingUser) {
                    // Auto-create super admin
                    await prisma.user.create({
                        data: {
                            email: user.email,
                            name: user.name || "Super Admin",
                            image: user.image,
                            role: "superadmin",
                            isActive: true,
                        },
                    });
                } else if (existingUser.role !== "superadmin") {
                    // Ensure super admin role
                    await prisma.user.update({
                        where: { email: user.email },
                        data: { role: "superadmin", isActive: true },
                    });
                }
                return true;
            }

            // Existing user - allow if active
            if (existingUser) {
                if (existingUser.isActive) {
                    return true;
                }
                // Inactive user - deny access
                return "/login?error=inactive";
            }

            // New user - allow by default (create as active user)
            await prisma.user.create({
                data: {
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: "user",
                    isActive: true,
                },
            });
            return true;
        },
        async jwt({ token, user }) {
            if (user?.email) {
                const dbUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });
                if (dbUser) {
                    token.role = dbUser.role;
                    token.isActive = dbUser.isActive;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = (token.role as string) || "pending";
                session.user.isActive = (token.isActive as boolean) ?? false;
            }
            return session;
        },
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
