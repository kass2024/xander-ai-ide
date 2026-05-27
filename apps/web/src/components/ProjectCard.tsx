"use client";

import { useState } from "react";
import { 
  Code, 
  GitBranch, 
  Users, 
  Clock, 
  Star, 
  MoreHorizontal,
  Play,
  Pause,
  Edit,
  Trash2,
  Eye,
  Share2,
  Terminal,
  Rocket,
  Shield,
  Database,
  Globe
} from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string;
    language: string;
    lastUpdated: string;
    stars: number;
    status: 'active' | 'archived' | 'draft';
    progress: number;
    team: string[];
    technologies: string[];
    deployments?: number;
    uptime?: string;
  };
  onAction?: (action: string, projectId: string) => void;
}

export default function ProjectCard({ project, onAction }: ProjectCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'archived': return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
      case 'draft': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      default: return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
    }
  };

  const getLanguageIcon = (language: string) => {
    switch (language.toLowerCase()) {
      case 'typescript': return <Code className="w-4 h-4 text-blue-600" />;
      case 'javascript': return <Code className="w-4 h-4 text-yellow-600" />;
      case 'python': return <Terminal className="w-4 h-4 text-green-600" />;
      case 'react': return <Globe className="w-4 h-4 text-cyan-600" />;
      default: return <Code className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 group">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              {getLanguageIcon(project.language)}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {project.name}
              </h3>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
              {project.description}
            </p>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Project
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Technologies */}
        <div className="flex flex-wrap gap-2 mb-4">
          {project.technologies?.map((tech, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md"
            >
              {tech}
            </span>
          ))}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
            <Clock className="w-4 h-4" />
            <span>{project.lastUpdated}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
            <Star className="w-4 h-4" />
            <span>{project.stars} stars</span>
          </div>
          {project.deployments && (
            <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <Rocket className="w-4 h-4" />
              <span>{project.deployments} deployments</span>
            </div>
          )}
          {project.uptime && (
            <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <Shield className="w-4 h-4" />
              <span>{project.uptime} uptime</span>
            </div>
          )}
        </div>

        {/* Progress */}
        {project.progress > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-600 dark:text-slate-400">Progress</span>
              <span className="text-slate-900 dark:text-white font-medium">{project.progress}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Team */}
        {project.team && project.team.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-slate-400" />
              <div className="flex -space-x-2">
                {project.team.slice(0, 3).map((member, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
                  >
                    <span className="text-xs text-white font-medium">
                      {member.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                ))}
                {project.team.length > 3 && (
                  <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      +{project.team.length - 3}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <Play className="w-4 h-4" />
              </button>
              <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <Terminal className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center space-x-1">
              <GitBranch className="w-3 h-3" />
              <span>main</span>
            </div>
            <div className="flex items-center space-x-1">
              <Database className="w-3 h-3" />
              <span>2.3MB</span>
            </div>
          </div>
          
          <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
            <Rocket className="w-3 h-3 mr-1" />
            Deploy
          </button>
        </div>
      </div>
    </div>
  );
}
