"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, User, CheckCircle, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface AuthFormProps {
  type: "login" | "register";
}

export default function AuthForm({ type }: AuthFormProps) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const { login, register, loading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("fullName") || "");

    try {
      if (type === "register") {
        await register(email, password, fullName || undefined);
        setMessage({ type: "success", text: "Account created! Redirecting to login..." });
        setTimeout(() => router.push("/auth/login"), 1500);
      } else {
        await login(email, password);
        setMessage({ type: "success", text: "Login successful! Redirecting..." });
        setTimeout(() => router.push("/dashboard"), 800);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg" />
            <span className="ml-2 text-xl font-bold text-slate-900 dark:text-white">Xander AI</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">
            {type === "register" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-center mb-8">
            {type === "register"
              ? "Start your free trial — syncs with Xander AI IDE desktop"
              : "Sign in to manage billing, usage, and account"}
          </p>

          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center ${
              message.type === "success"
                ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
            }`}>
              {message.type === "success" ? (
                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {type === "register" && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    placeholder="Enter your full name"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input id="email" name="email" type="email" required autoComplete="email"
                  className="w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="Enter your email" disabled={loading} />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input id="password" name="password" type="password" required
                  autoComplete={type === "register" ? "new-password" : "current-password"}
                  className="w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder={type === "register" ? "Create a password" : "Enter your password"}
                  disabled={loading} />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 px-4 text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50">
              {loading ? (type === "register" ? "Creating Account..." : "Signing In...") : (type === "register" ? "Create Account" : "Sign In")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {type === "register" ? "Already have an account?" : "Don't have an account?"}{" "}
              <Link href={type === "register" ? "/auth/login" : "/auth/register"} className="text-blue-600 hover:text-blue-500 font-medium">
                {type === "register" ? "Sign in" : "Sign up for free"}
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
