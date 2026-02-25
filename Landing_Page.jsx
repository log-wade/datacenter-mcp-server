import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown, Check, Zap } from 'lucide-react';

export default function LandingPage() {
  const [expandedTool, setExpandedTool] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('Starter');

  const tools = [
    {
      name: 'Cooling Load Calculator',
      description: 'Precision thermal management',
      details: 'Calculate cooling requirements based on equipment heat output, environmental factors, and facility specifications. Optimize for energy efficiency and maintain optimal operating temperatures.',
      icon: '❄️'
    },
    {
      name: 'Power Redundancy Analyzer',
      description: 'Ensure system reliability',
      details: 'Analyze power distribution paths, identify single points of failure, and verify redundancy across UPS systems, PDUs, and distribution circuits.',
      icon: '⚡'
    },
    {
      name: 'Tier Classification Assessment',
      description: 'Industry-standard compliance',
      details: 'Evaluate your facility against Uptime Institute standards (Tier I-IV). Identify gaps and generate compliance roadmaps for enhanced availability tiers.',
      icon: '📊'
    },
    {
      name: 'Commissioning Plan Generator',
      description: 'Streamlined deployment',
      details: 'Generate comprehensive commissioning checklists, test procedures, and documentation for new datacenter deployments or facility upgrades.',
      icon: '📋'
    },
    {
      name: 'Rack Density Analyzer',
      description: 'Optimize space utilization',
      details: 'Analyze power and cooling constraints by rack, identify density bottlenecks, and model expansion scenarios for efficient capacity planning.',
      icon: '📦'
    },
    {
      name: 'GPU Power & Cooling Optimizer',
      description: 'Advanced GPU thermal management',
      details: 'Specialized tool for high-performance computing environments. Calculate power requirements and cooling strategies for GPU-intensive workloads with precision.',
      icon: '🎮',
      badge: 'PREMIUM'
    },
    {
      name: 'UPS & Battery Sizing Calculator',
      description: 'Precise battery backup planning',
      details: 'Size UPS systems and battery banks based on load profiles, desired runtime, and efficiency curves. Include aging factors and environmental conditions.',
      icon: '🔋',
      badge: 'PREMIUM'
    },
    {
      name: 'Reference Data Lookup',
      description: 'Instant technical specifications',
      details: 'Access comprehensive database of equipment specifications, thermal properties, and power ratings for thousands of datacenter components.',
      icon: '📚'
    }
  ];

  const plans = {
    'Free': { price: 0, features: ['Power Redundancy Analyzer', 'Tier Classification Assessment', 'Reference Data Lookup', 'Community Support'] },
    'Starter': { price: 149, features: ['All Free features', 'Cooling Load Calculator', 'Rack Density Analyzer', 'Priority Email Support', 'Monthly Updates'] },
    'Pro': { price: 599, features: ['All Starter features', 'Commissioning Plan Generator', 'GPU Power & Cooling Optimizer', 'Phone Support', 'API Access'] },
    'Enterprise': { price: 2999, features: ['All Pro features', 'UPS & Battery Sizing Calculator', 'Dedicated Account Manager', 'Custom Integrations', '24/7 Support', 'SLA Guarantee'] }
  };

  const revenueData = [
    { month: 'Jan', revenue: 5000 },
    { month: 'Feb', revenue: 5000 },
    { month: 'Mar', revenue: 13797 },
    { month: 'Apr', revenue: 14594 },
    { month: 'May', revenue: 20489 },
    { month: 'Jun', revenue: 29583 },
    { month: 'Jul', revenue: 37874 },
    { month: 'Aug', revenue: 48462 },
    { month: 'Sep', revenue: 52346 },
    { month: 'Oct', revenue: 63625 },
    { month: 'Nov', revenue: 74496 },
    { month: 'Dec', revenue: 85072 }
  ];

  const annualCost = plans[selectedPlan].price * 12;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl"></div>
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-teal-500 rounded-full mix-blend-screen filter blur-3xl"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-6xl sm:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 bg-clip-text text-transparent">
            NextGen Mission Critical
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 mb-4">datacenter-mcp-server</p>
          <h2 className="text-2xl sm:text-3xl text-gray-100 mb-12 font-light">
            The Premier MCP Server for Data Center Engineering
          </h2>
          
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto mb-12">
            <div className="bg-slate-800/50 backdrop-blur border border-blue-500/30 rounded-lg p-4 sm:p-6">
              <div className="text-4xl sm:text-5xl font-bold text-blue-400">8</div>
              <p className="text-gray-400 text-sm sm:text-base mt-2">Powerful Tools</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg p-4 sm:p-6">
              <div className="text-4xl sm:text-5xl font-bold text-teal-400">264</div>
              <p className="text-gray-400 text-sm sm:text-base mt-2">Test Coverage</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur border border-green-500/30 rounded-lg p-4 sm:p-6">
              <div className="text-4xl sm:text-5xl font-bold text-green-400">0</div>
              <p className="text-gray-400 text-sm sm:text-base mt-2">Competitors</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tool Showcase */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-transparent bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text">
            Comprehensive Toolkit
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((tool, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg overflow-hidden hover:border-blue-500/50 transition-all duration-300 cursor-pointer"
                onClick={() => setExpandedTool(expandedTool === idx ? null : idx)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{tool.icon}</span>
                      <div>
                        <h3 className="text-xl font-bold text-white">{tool.name}</h3>
                        <p className="text-gray-400 text-sm">{tool.description}</p>
                      </div>
                    </div>
                    {tool.badge && (
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  
                  {expandedTool === idx && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-gray-300 text-sm leading-relaxed">{tool.details}</p>
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center text-blue-400 text-sm font-semibold">
                    {expandedTool === idx ? 'Hide details' : 'View details'}
                    <ChevronDown className={`ml-2 w-4 h-4 transition-transform ${expandedTool === idx ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Calculator */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-16 text-transparent bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text">
            Flexible Pricing
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
            {Object.keys(plans).map(plan => (
              <button
                key={plan}
                onClick={() => setSelectedPlan(plan)}
                className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                  selectedPlan === plan
                    ? 'bg-gradient-to-r from-blue-600 to-teal-600 text-white'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                {plan}
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">{selectedPlan}</h3>
                <p className="text-gray-400 mb-6">
                  {plans[selectedPlan].price === 0 ? 'Free' : `$${plans[selectedPlan].price}`}
                  {plans[selectedPlan].price > 0 && <span className="text-gray-500">/month</span>}
                </p>
                
                <div className="space-y-3 mb-8">
                  {plans[selectedPlan].features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-gray-200">{feature}</span>
                    </div>
                  ))}
                </div>

                <button className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-bold py-3 rounded-lg transition-all">
                  Get Started
                </button>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                <h4 className="text-lg font-bold text-white mb-4">Annual Cost</h4>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text">
                    ${annualCost.toLocaleString()}
                  </span>
                  <span className="text-gray-400">/year</span>
                </div>
                <p className="text-gray-400 text-sm">
                  {plans[selectedPlan].price === 0
                    ? 'Perfect for evaluating the platform'
                    : `Save ${Math.round((1 - annualCost / plans['Enterprise'].price * 12) * 100)}% vs Enterprise`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Projection Chart */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-4 text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text">
            12-Month Revenue Projection
          </h2>
          <p className="text-center text-gray-400 mb-12">Zero-burn financial model with sustainable growth</p>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-8">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => `$${value.toLocaleString()}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#06b6d4', r: 5 }}
                  activeDot={{ r: 7 }}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 border-t border-slate-700">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-gradient-to-r from-blue-600/20 to-teal-600/20 border border-blue-500/30 rounded-lg p-8 md:p-12">
            <p className="text-2xl sm:text-3xl font-bold text-transparent bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 bg-clip-text">
              Zero competitors. Zero burn. Day one profitable.
            </p>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-700">
            <p className="text-gray-500 text-sm">
              © 2026 NextGen Mission Critical. The premier MCP server for datacenter engineering.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
