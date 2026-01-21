import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isDev = process.env.NODE_ENV !== "production";

    // Public routes that don't require authentication
    const publicRoutes = [
        "/login",
        "/api/auth",
        "/feed",        // Public feed pages  
        "/api/cms",     // CMS API (temporarily public for testing)
    ];

    // Dev-only routes (require admin in production, public in dev)
    const devOnlyRoutes = [
        "/api/digital-footprint/verify",
        "/api/digital-footprint/diagnose",
        "/api/digital-footprint/cleanup-orphans",
        "/api/digital-footprint/test-scan",
    ];

    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
    const isDevOnlyRoute = devOnlyRoutes.some(route => pathname.startsWith(route));

    // Allow public routes
    if (isPublicRoute) {
        return NextResponse.next();
    }

    // Dev-only routes: allow in dev, require admin in production
    if (isDevOnlyRoute) {
        if (isDev) {
            return NextResponse.next();
        }
        // In production, require admin token
        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
        });

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = token.role as string;
        if (role !== "superadmin" && role !== "admin") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        return NextResponse.next();
    }

    // Check for session token
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    // Redirect to login if not authenticated
    if (!token) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Check if user is active (stored in token)
    if (token.isActive === false) {
        return NextResponse.redirect(new URL("/login?error=inactive", request.url));
    }

    // Admin routes - only superadmin and admin can access
    if (pathname.startsWith("/admin")) {
        const role = token.role as string;
        if (role !== "superadmin" && role !== "admin") {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Match all routes except static files and images
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
