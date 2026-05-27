import Link from "next/link";
import { ArrowRight, Zap, Code, GitBranch, Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Navigation */}
      <nav className="px-6 py-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg"></div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">Xander AI</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Features
            </Link>
            <Link href="#pricing" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Pricing
            </Link>
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Dashboard
            </Link>
            <Link href="/auth/login" className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:text-white dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700">
              Sign In
            </Link>
            <Link href="/auth/register" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 mb-6">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">AI-Powered Coding Assistant</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6">
            Code Faster with
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              AI Intelligence
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
            Experience the power of AI in your IDE. Get intelligent autocomplete, contextual chat, 
            multi-file editing, and Git integration - all in one seamless development environment.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/auth/register" className="inline-flex items-center px-6 py-3 text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors">
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/download" className="inline-flex items-center px-6 py-3 text-lg font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:text-white dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors">
              Download Desktop App
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">10x</div>
              <div className="text-slate-600 dark:text-slate-400">Faster Development</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">95%</div>
              <div className="text-slate-600 dark:text-slate-400">Accuracy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">50K+</div>
              <div className="text-slate-600 dark:text-slate-400">Active Developers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 md:px-8 lg:px-12 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Everything You Need in an AI IDE
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
              Built for modern developers who want to code faster and smarter with AI assistance.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
                <Code className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">AI Autocomplete</h3>
              <p className="text-slate-600 dark:text-slate-300">
                Context-aware code completion that understands your project and coding style.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-4">
                <GitBranch className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Smart Git Integration</h3>
              <p className="text-slate-600 dark:text-slate-300">
                AI-powered commit messages, branch management, and seamless Git workflow.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-200 dark:hover:border-green-800 transition-colors">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Enterprise Security</h3>
              <p className="text-slate-600 dark:text-slate-300">
                End-to-end encryption, secure code storage, and compliance with industry standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 md:px-8 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Ready to Transform Your Development?
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
            Join thousands of developers already using Xander AI to build better code, faster.
          </p>
          <Link href="/auth/register" className="inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors">
            Start Your Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 md:px-8 lg:px-12 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg"></div>
            <span className="text-lg font-semibold text-slate-900 dark:text-white">Xander AI</span>
          </div>
          <div className="flex items-center space-x-6 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
            <Link href="/support" className="hover:text-slate-900 dark:hover:text-white">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
