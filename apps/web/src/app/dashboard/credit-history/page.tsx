"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { CreditCard, TrendingUp, TrendingDown, Download, Calendar, Search, Filter } from "lucide-react";

interface CreditTransaction {
  id: string;
  type: "purchase" | "usage" | "refund" | "bonus" | "adjustment";
  amount: number;
  balance: number;
  description: string;
  date: string;
  metadata?: {
    model?: string;
    tokens?: number;
    plan?: string;
  };
}

export default function CreditHistoryPage() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await apiClient.getCreditHistory(currentPage, 10, filterType === "all" ? undefined : filterType);
        setTransactions(
          data.transactions.map((tx) => ({
            ...tx,
            type: tx.type as CreditTransaction["type"],
          })),
        );
        setTotalPages(data.pagination.pages);
      } catch (error) {
        console.error("Failed to load credit history:", error);
        setTransactions([]);
        setTotalPages(0);
      }
    };
    loadHistory();
  }, [currentPage, filterType]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "usage":
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case "refund":
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case "bonus":
        return <TrendingUp className="w-4 h-4 text-purple-500" />;
      case "adjustment":
        return <TrendingUp className="w-4 h-4 text-orange-500" />;
      default:
        return <CreditCard className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    if (amount > 0) return "text-green-600";
    if (amount < 0) return "text-red-600";
    return "text-gray-600";
  };

  const formatAmount = (amount: number) => {
    const sign = amount > 0 ? "+" : "";
    return `${sign}${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = transaction.description
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || transaction.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * 10,
    currentPage * 10
  );

  const currentBalance = transactions.length > 0 ? transactions[0].balance : 0;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Credit History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your credit transactions, purchases, and usage over time.
          </p>
        </div>

        {/* Current Balance Card */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 mb-8 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Current Credit Balance
              </h2>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {currentBalance.toLocaleString()} credits
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Last updated: {formatDate(transactions[0]?.date || new Date().toISOString())}
              </p>
            </div>
            <div className="text-right">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                <CreditCard className="w-4 h-4 mr-2" />
                Buy Credits
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="purchase">Purchases</option>
              <option value="usage">Usage</option>
              <option value="refund">Refunds</option>
              <option value="bonus">Bonuses</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>
          <button className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>

        {/* Transactions Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getTransactionIcon(transaction.type)}
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {transaction.description}
                          </p>
                          {transaction.metadata && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {transaction.metadata.model && `Model: ${transaction.metadata.model}`}
                              {transaction.metadata.tokens && ` • Tokens: ${transaction.metadata.tokens}`}
                              {transaction.metadata.plan && ` • Plan: ${transaction.metadata.plan}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                        transaction.type === 'purchase' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        transaction.type === 'usage' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        transaction.type === 'refund' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        transaction.type === 'bonus' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${getTransactionColor(transaction.type, transaction.amount)}`}>
                        {formatAmount(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {transaction.balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(transaction.date)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, filteredTransactions.length)} of{" "}
                {filteredTransactions.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
