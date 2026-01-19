'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useDevMode } from '@/contexts/DevModeContext';
import ApiStatusIndicator from '@/components/ApiStatusIndicator';

// Menu item definitions
const menuSections = [
    {
        id: 'footprint',
        label: 'Digital Presence',
        icon: '🌐',
        color: 'blue',
        items: [
            { href: '/digital-footprint', label: 'Know Your Footprint' },
            { href: '/admin/footprint-registry', label: 'Footprint Registry' },
        ],
    },
    {
        id: 'master',
        label: 'Master Data',
        icon: '🗂️',
        items: [
            { href: '/clients', label: 'Clients' },
            { href: '/competitors', label: 'Competitors' },
            { href: '/master/domain-credibility-age', label: 'Domain Credibility' },
            { href: '/master/domain-authority', label: 'Domain Authority' },
            { href: '/keywords/manual', label: 'Keyword Manual' },
        ],
    },
    {
        id: 'curated',
        label: 'Curated Data',
        icon: '✨',
        items: [
            { href: '/curated/keywords', label: 'Keywords' },
            { href: '/curated/links', label: 'Links' },
            { href: '/curated/client-position', label: 'Client Position' },
            { href: '/curated/client-rank', label: 'Client Rank' },
            { href: '/curated/client-serp', label: 'Client SERP' },
        ],
    },
    {
        id: 'reports',
        label: 'Reports',
        icon: '📊',
        items: [
            { href: '/report/dashboard', label: 'Dashboard' },
            { href: '/report/competitors', label: 'Unique Domains' },
            { href: '/report/cluster-intelligence', label: 'Cluster Intelligence' },
            { href: '/report/cluster-intelligence-1', label: 'Cluster (URL)' },
            { href: '/report/client-data-export', label: 'Data Export' },
        ],
    },
    {
        id: 'seodata',
        label: 'SEO Data',
        icon: '🔍',
        items: [
            { href: '/keywords/api-data', label: 'Keyword API' },
            { href: '/keywords/serp-results', label: 'SERP Results' },
            { href: '/keywords/domain-overview', label: 'Domain Overview' },
            { href: '/keywords/domain-pages', label: 'Domain Pages' },
            { href: '/keywords/domain-keywords', label: 'Domain Keywords' },
            { href: '/keywords/cluster-intent-studio', label: '🧠 Cluster Studio' },
            { href: '/keywords/page-intent-analysis', label: 'Page Intent' },
        ],
    },
    {
        id: 'gap',
        label: 'Gap & Content',
        icon: '📈',
        items: [
            { href: '/gap-content/domain-gap-analysis', label: 'Domain Gap Analysis' },
        ],
    },
    {
        id: 'cms',
        label: 'CMS',
        icon: '📝',
        color: 'green',
        items: [
            { href: '/cms', label: 'Dashboard' },
            { href: '/cms/templates', label: 'Templates' },
        ],
    },
    {
        id: 'admin',
        label: 'Admin',
        icon: '⚙️',
        items: [
            { href: '/admin', label: 'User Management' },
            { href: '/admin/comments', label: 'Comments & Tasks' },
            { href: '/admin/site-master', label: 'Site Master' },
        ],
    },
    {
        id: 'aitest',
        label: 'AI Test',
        icon: '🧠',
        color: 'purple',
        items: [
            { href: '/ai-test/gradio', label: 'Gradio Test' },
        ],
    },
];

// Hub section has nested subsections
const hubSection = {
    id: 'hub',
    label: 'Content Hub',
    icon: '🏭',
    subsections: [
        {
            title: 'Categories',
            items: [
                { href: '/twisting-machines', label: 'Hub Home' },
                { href: '/twisting-machines/tfo-twisters', label: 'TFO Twisters' },
                { href: '/twisting-machines/ring-twisters', label: 'Ring Twisters' },
                { href: '/twisting-machines/spun-yarn-twisters', label: 'Spun Yarn' },
            ],
        },
        {
            title: 'Applications',
            items: [
                { href: '/twisting-machines/applications/industrial-yarn', label: 'Industrial Yarn' },
                { href: '/twisting-machines/applications/carpet-yarn', label: 'Carpet Yarn' },
                { href: '/twisting-machines/applications/rope-cordage', label: 'Rope & Cordage' },
            ],
        },
        {
            title: 'Comparisons',
            items: [
                { href: '/compare/tfo-vs-ring-twister', label: 'TFO vs Ring' },
                { href: '/compare/cabler-vs-two-for-one-twister', label: 'Cabler vs TFO' },
            ],
        },
        {
            title: 'Guides',
            items: [
                { href: '/guides/what-is-a-tfo-machine', label: 'What is TFO?' },
                { href: '/guides/yarn-twist-calculation', label: 'Twist Calculation' },
            ],
        },
    ],
};

export default function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { isDevMode, toggle: toggleDevMode } = useDevMode();
    const [collapsed, setCollapsed] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [expandedHubSubsections, setExpandedHubSubsections] = useState<Set<string>>(new Set());

    // Auto-expand section that contains current path
    useEffect(() => {
        const newExpanded = new Set<string>();
        menuSections.forEach(section => {
            if (section.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) {
                newExpanded.add(section.id);
            }
        });
        // Check hub section
        hubSection.subsections.forEach(sub => {
            if (sub.items.some(item => pathname === item.href || pathname.startsWith(item.href))) {
                newExpanded.add('hub');
            }
        });
        if (newExpanded.size > 0) {
            setExpandedSections(newExpanded);
        }
    }, [pathname]);

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    const toggleHubSubsection = (title: string) => {
        setExpandedHubSubsections(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    };

    const isItemActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

    const SectionIcon = ({ icon, color }: { icon: string; color?: string }) => (
        <span className={`text-lg ${collapsed ? '' : 'mr-3'}`}>{icon}</span>
    );

    const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
        <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
    );

    return (
        <aside
            className={`fixed left-0 top-0 h-screen bg-slate-900 text-white shadow-xl z-50 transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-64'
                }`}
        >
            {/* Logo / Brand */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-slate-700">
                {!collapsed && (
                    <Link href="/" className="text-lg font-bold text-white hover:text-indigo-400 transition-colors">
                        Motani
                    </Link>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <svg
                        className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2">
                {/* Home Link */}
                <Link
                    href="/"
                    className={`flex items-center px-3 py-2 mb-2 rounded-lg transition-colors ${pathname === '/'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                >
                    <span className={`text-lg ${collapsed ? '' : 'mr-3'}`}>🏠</span>
                    {!collapsed && <span className="text-sm font-medium">Home</span>}
                </Link>

                {/* Menu Sections */}
                {menuSections.map(section => {
                    const isExpanded = expandedSections.has(section.id);
                    const hasActiveItem = section.items.some(item => isItemActive(item.href));
                    const colorClass = section.color === 'green' ? 'text-green-400' : section.color === 'purple' ? 'text-purple-400' : 'text-slate-300';

                    return (
                        <div key={section.id} className="mb-1">
                            <button
                                onClick={() => toggleSection(section.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${hasActiveItem
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                title={collapsed ? section.label : undefined}
                            >
                                <div className="flex items-center">
                                    <SectionIcon icon={section.icon} color={section.color} />
                                    {!collapsed && <span className={`text-sm font-medium ${colorClass}`}>{section.label}</span>}
                                </div>
                                {!collapsed && <ChevronIcon expanded={isExpanded} />}
                            </button>

                            {/* Submenu */}
                            {!collapsed && isExpanded && (
                                <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
                                    {section.items.map(item => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${isItemActive(item.href)
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                }`}
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Hub Section (with nested subsections) */}
                <div className="mb-1">
                    <button
                        onClick={() => toggleSection('hub')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${pathname.startsWith('/twisting') || pathname.startsWith('/compare') || pathname.startsWith('/guides')
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                        title={collapsed ? hubSection.label : undefined}
                    >
                        <div className="flex items-center">
                            <SectionIcon icon={hubSection.icon} />
                            {!collapsed && <span className="text-sm font-medium">{hubSection.label}</span>}
                        </div>
                        {!collapsed && <ChevronIcon expanded={expandedSections.has('hub')} />}
                    </button>

                    {!collapsed && expandedSections.has('hub') && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-3">
                            {hubSection.subsections.map(sub => (
                                <div key={sub.title}>
                                    <button
                                        onClick={() => toggleHubSubsection(sub.title)}
                                        className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-500 uppercase hover:text-slate-300 transition-colors"
                                    >
                                        {sub.title}
                                        <ChevronIcon expanded={expandedHubSubsections.has(sub.title)} />
                                    </button>
                                    {expandedHubSubsections.has(sub.title) && (
                                        <div className="space-y-0.5 mt-0.5">
                                            {sub.items.map(item => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`block px-3 py-1 text-xs rounded-md transition-colors ${isItemActive(item.href)
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                        }`}
                                                >
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </nav>

            {/* Bottom section - User & Settings */}
            <div className="border-t border-slate-700 p-3 space-y-2">
                {/* Dev Mode Toggle */}
                <button
                    onClick={toggleDevMode}
                    className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${isDevMode
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                    title={isDevMode ? 'Dev Mode ON' : 'Dev Mode OFF'}
                >
                    <span className={`text-lg ${collapsed ? '' : 'mr-3'}`}>🔧</span>
                    {!collapsed && <span className="text-sm">Dev Mode</span>}
                    {!collapsed && isDevMode && (
                        <span className="ml-auto text-xs bg-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded">ON</span>
                    )}
                </button>

                {/* API Status Indicator */}
                {!collapsed && <ApiStatusIndicator />}

                {/* Settings */}
                <Link
                    href="/settings/api-credentials"
                    className={`flex items-center px-3 py-2 rounded-lg transition-colors ${pathname === '/settings/api-credentials'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                    title="Settings"
                >
                    <span className={`text-lg ${collapsed ? '' : 'mr-3'}`}>⚙️</span>
                    {!collapsed && <span className="text-sm">Settings</span>}
                </Link>

                {/* User Profile */}
                {session?.user && (
                    <div className={`${collapsed ? 'px-1' : 'px-2'} py-2`}>
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                            {session.user.image ? (
                                <img
                                    src={session.user.image}
                                    alt={session.user.name || 'User'}
                                    className="w-8 h-8 rounded-full ring-2 ring-slate-600"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                                    {session.user.email?.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {!collapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
                                </div>
                            )}
                        </div>
                        {!collapsed && (
                            <button
                                onClick={() => signOut({ callbackUrl: '/login' })}
                                className="w-full mt-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                Sign out
                            </button>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
