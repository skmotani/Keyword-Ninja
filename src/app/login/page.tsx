'use client';

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo and Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-lg rounded-2xl mb-4">
                        <span className="text-4xl">🥷</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Keyword Ninja</h1>
                    <p className="text-white/70">SEO Intelligence Platform</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
                    <h2 className="text-xl font-semibold text-white text-center mb-6">
                        Sign in to continue
                    </h2>

                    {/* Error Messages */}
                    {error === "pending" && (
                        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <span className="text-xl">⏳</span>
                                <div>
                                    <p className="text-amber-200 font-medium">Access Pending</p>
                                    <p className="text-amber-200/70 text-sm mt-1">
                                        Your account is awaiting approval. Please contact the administrator.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {error === "inactive" && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <span className="text-xl">🚫</span>
                                <div>
                                    <p className="text-red-200 font-medium">Account Inactive</p>
                                    <p className="text-red-200/70 text-sm mt-1">
                                        Your account has been disabled. Please contact the administrator.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && error !== "pending" && error !== "inactive" && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                            <p className="text-red-200 text-sm text-center">
                                Authentication failed. Please try again.
                            </p>
                        </div>
                    )}

                    {/* Google Sign In Button */}
                    <button
                        onClick={() => signIn("google", { callbackUrl })}
                        className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>

                    <p className="text-white/50 text-xs text-center mt-6">
                        Only authorized users can access this platform.
                        <br />
                        Contact admin for access.
                    </p>
                </div>

                {/* Footer */}
                <p className="text-white/40 text-xs text-center mt-8">
                    © 2026 Keyword Ninja. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
