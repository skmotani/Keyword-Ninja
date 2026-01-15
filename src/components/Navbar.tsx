'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useDevMode } from '@/contexts/DevModeContext';

const masterItems = [
  { href: '/clients', label: 'Clients' },
  { href: '/competitors', label: 'Competitors' },
  { href: '/master/domain-credibility-age', label: 'Domain Credibility, Age' },
  { href: '/master/domain-authority', label: 'Domain Authority' },
  { href: '/keywords/manual', label: 'Keyword Manual' },
];

const curatedItems = [
  { href: '/curated/keywords', label: 'Curated Keywords' },
  { href: '/curated/links', label: 'Curated Links' },
  { href: '/curated/client-position', label: 'Client Position' },
  { href: '/curated/client-rank', label: 'Client Rank' },
  { href: '/curated/client-serp', label: 'Client SERP' },
];

const reportItems = [
  { href: '/report/dashboard', label: 'Dashboard' },
  { href: '/report/competitors', label: 'Unique Domains' },
  { href: '/report/cluster-intelligence', label: 'Cluster Intelligence' },
  { href: '/report/cluster-intelligence-1', label: 'Cluster Intelligence (URL)' },
  { href: '/report/client-data-export', label: 'Page Client Data Export' },
];

const hubCategories = [
  { href: '/twisting-machines/tfo-twisters', label: 'TFO Twisters' },
  { href: '/twisting-machines/ring-twisters', label: 'Ring Twisters' },
  { href: '/twisting-machines/spun-yarn-twisters', label: 'Spun Yarn Twisters' },
];

const hubApplications = [
  { href: '/twisting-machines/applications/industrial-yarn', label: 'Industrial Yarn' },
  { href: '/twisting-machines/applications/carpet-yarn', label: 'Carpet Yarn' },
  { href: '/twisting-machines/applications/rope-cordage', label: 'Rope & Cordage' },
  { href: '/twisting-machines/applications/embroidery-thread', label: 'Embroidery Thread' },
  { href: '/twisting-machines/applications/medical-suture', label: 'Medical Sutures' },
  { href: '/twisting-machines/applications/monofilament', label: 'Monofilament' },
];

const hubComparisons = [
  { href: '/compare/tfo-vs-ring-twister', label: 'TFO vs Ring Twister' },
  { href: '/compare/cabler-vs-two-for-one-twister', label: 'Cabler vs TFO' },
  { href: '/compare/tfo-machine-price-vs-output', label: 'TFO Price vs Output' },
];

const hubGuides = [
  { href: '/guides/what-is-a-tfo-machine', label: 'What is TFO?' },
  { href: '/guides/yarn-twist-calculation', label: 'Twist Calculation' },
  { href: '/guides/yarn-ballooning-solution', label: 'Ballooning Solutions' },
  { href: '/guides/twisting-defects-and-solutions', label: 'Defects & Solutions' },
];

const allHubItems = [
  { href: '/twisting-machines', label: 'Hub Home' },
  ...hubCategories,
  ...hubApplications,
  ...hubComparisons,
  ...hubGuides,
];

const seoDataItems = [
  { href: '/keywords/api-data', label: 'Keyword API Data' },
  { href: '/keywords/serp-results', label: 'SERP Results' },
  { href: '/keywords/domain-overview', label: 'Domain Overview' },
  { href: '/keywords/domain-pages', label: 'Domain Top Pages' },
  { href: '/keywords/domain-keywords', label: 'Domain Top Keywords' },
  { href: '/keywords/cluster-intent-studio', label: '🧠 Cluster & Intent Studio' },
  { href: '/keywords/page-intent-analysis', label: 'Page Intent Analysis' },
];

const gapContentItems = [
  { href: '/gap-content/domain-gap-analysis', label: 'Domain Gap Analysis' },
];

const adminItems = [
  { href: '/admin', label: '👤 User Management' },
  { href: '/admin/comments', label: 'Comments & Tasks' },
  { href: '/admin/site-master', label: 'Site Master' },
];

const aiTestItems = [
  { href: '/ai-test/gradio', label: 'Gradio Test' },
];

const cmsItems = [
  { href: '/cms', label: '📊 Dashboard' },
  { href: '/cms/templates', label: '📄 Templates' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isDevMode, toggle: toggleDevMode } = useDevMode();
  const [masterOpen, setMasterOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [seoDataOpen, setSeoDataOpen] = useState(false);
  const [curatedOpen, setCuratedOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [gapContentOpen, setGapContentOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [aiTestOpen, setAiTestOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cmsOpen, setCmsOpen] = useState(false);

  const masterRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const seoDataRef = useRef<HTMLDivElement>(null);
  const curatedRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const gapContentRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const aiTestRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const cmsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (masterRef.current && !masterRef.current.contains(event.target as Node)) {
        setMasterOpen(false);
      }
      if (reportRef.current && !reportRef.current.contains(event.target as Node)) {
        setReportOpen(false);
      }
      if (seoDataRef.current && !seoDataRef.current.contains(event.target as Node)) {
        setSeoDataOpen(false);
      }
      if (hubRef.current && !hubRef.current.contains(event.target as Node)) {
        setHubOpen(false);
      }
      if (curatedRef.current && !curatedRef.current.contains(event.target as Node)) {
        setCuratedOpen(false);
      }
      if (gapContentRef.current && !gapContentRef.current.contains(event.target as Node)) {
        setGapContentOpen(false);
      }
      if (adminRef.current && !adminRef.current.contains(event.target as Node)) {
        setAdminOpen(false);
      }
      if (aiTestRef.current && !aiTestRef.current.contains(event.target as Node)) {
        setAiTestOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (cmsRef.current && !cmsRef.current.contains(event.target as Node)) {
        setCmsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isMasterActive = masterItems.some(item => pathname === item.href);
  const isReportActive = reportItems.some(item => pathname === item.href);
  const isSeoDataActive = seoDataItems.some(item => pathname === item.href);
  const isCuratedActive = curatedItems.some(item => pathname === item.href);
  const isHubActive = allHubItems.some(item => pathname === item.href) || pathname.startsWith('/twisting-machines') || pathname.startsWith('/compare') || pathname.startsWith('/guides');
  const isGapContentActive = gapContentItems.some(item => pathname === item.href) || pathname.startsWith('/gap-content');
  const isAdminActive = adminItems.some(item => pathname === item.href);
  const isAiTestActive = aiTestItems.some(item => pathname === item.href) || pathname.startsWith('/ai-test');
  const isCmsActive = cmsItems.some(item => pathname === item.href) || pathname.startsWith('/cms');

  const DropdownArrow = ({ isOpen }: { isOpen: boolean }) => (
    <svg
      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              SEO Intelligence
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname === '/'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              Home
            </Link>

            <div className="relative" ref={masterRef}>
              <button
                onClick={() => {
                  setMasterOpen(!masterOpen);
                  setReportOpen(false);
                  setSeoDataOpen(false);
                  setCuratedOpen(false);
                  setHubOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isMasterActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                Master
                <DropdownArrow isOpen={masterOpen} />
              </button>

              {masterOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {masterItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMasterOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={curatedRef}>
              <button
                onClick={() => {
                  setCuratedOpen(!curatedOpen);
                  setMasterOpen(false);
                  setReportOpen(false);
                  setSeoDataOpen(false);
                  setHubOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isCuratedActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                Curated
                <DropdownArrow isOpen={curatedOpen} />
              </button>

              {curatedOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {curatedItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setCuratedOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={reportRef}>
              <button
                onClick={() => {
                  setReportOpen(!reportOpen);
                  setMasterOpen(false);
                  setSeoDataOpen(false);
                  setHubOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isReportActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                Reports
                <DropdownArrow isOpen={reportOpen} />
              </button>

              {reportOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {reportItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setReportOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={seoDataRef}>
              <button
                onClick={() => {
                  setSeoDataOpen(!seoDataOpen);
                  setMasterOpen(false);
                  setReportOpen(false);
                  setHubOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isSeoDataActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                SeoData
                <DropdownArrow isOpen={seoDataOpen} />
              </button>

              {seoDataOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {seoDataItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSeoDataOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={hubRef}>
              <button
                onClick={() => {
                  setHubOpen(!hubOpen);
                  setMasterOpen(false);
                  setReportOpen(false);
                  setSeoDataOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isHubActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                Hub
                <DropdownArrow isOpen={hubOpen} />
              </button>

              {hubOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-md shadow-lg border z-50 max-h-96 overflow-y-auto">
                  <Link
                    href="/twisting-machines"
                    onClick={() => setHubOpen(false)}
                    className={`block px-4 py-2 text-sm font-semibold transition-colors border-b ${pathname === '/twisting-machines'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-indigo-600 hover:bg-gray-100'
                      }`}
                  >
                    Twisting Machines Hub
                  </Link>
                  {/* ... rest of hub items ... */}
                  <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50 uppercase">Categories</div>
                  {hubCategories.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setHubOpen(false)}
                      className={`block px-4 py-1.5 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {/* ... other sections ... */}
                  <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50 uppercase">Applications</div>
                  {hubApplications.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setHubOpen(false)}
                      className={`block px-4 py-1.5 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50 uppercase">Comparisons</div>
                  {hubComparisons.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setHubOpen(false)}
                      className={`block px-4 py-1.5 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50 uppercase">Guides</div>
                  {hubGuides.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setHubOpen(false)}
                      className={`block px-4 py-1.5 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={gapContentRef}>
              <button
                onClick={() => {
                  setGapContentOpen(!gapContentOpen);
                  setMasterOpen(false);
                  setReportOpen(false);
                  setSeoDataOpen(false);
                  setCuratedOpen(false);
                  setHubOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isGapContentActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                Gap & Content
                <DropdownArrow isOpen={gapContentOpen} />
              </button>

              {gapContentOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {gapContentItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setGapContentOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={cmsRef}>
              <button
                onClick={() => {
                  setCmsOpen(!cmsOpen);
                  setMasterOpen(false);
                  setReportOpen(false);
                  setSeoDataOpen(false);
                  setCuratedOpen(false);
                  setHubOpen(false);
                  setGapContentOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isCmsActive
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                📝 CMS
                <DropdownArrow isOpen={cmsOpen} />
              </button>

              {cmsOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {cmsItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setCmsOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-green-50 text-green-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={adminRef}>
              <button
                onClick={() => {
                  setAdminOpen(!adminOpen);
                  setMasterOpen(false);
                  setReportOpen(false);
                  setSeoDataOpen(false);
                  setCuratedOpen(false);
                  setHubOpen(false);
                  setGapContentOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isAdminActive
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                Admin
                <DropdownArrow isOpen={adminOpen} />
              </button>

              {adminOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {adminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAdminOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* AI TEST Menu */}
            <div className="relative" ref={aiTestRef}>
              <button
                onClick={() => {
                  setAiTestOpen(!aiTestOpen);
                  setMasterOpen(false);
                  setReportOpen(false);
                  setSeoDataOpen(false);
                  setCuratedOpen(false);
                  setHubOpen(false);
                  setGapContentOpen(false);
                  setAdminOpen(false);
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isAiTestActive
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                🧠 AI Test
                <DropdownArrow isOpen={aiTestOpen} />
              </button>

              {aiTestOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-50">
                  {aiTestItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAiTestOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${pathname === item.href
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Developer Mode Toggle */}
            <button
              onClick={toggleDevMode}
              className={`ml-2 p-2 rounded-md transition-all cursor-pointer ${isDevMode
                ? 'text-amber-600 bg-amber-100 ring-2 ring-amber-400'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              title={isDevMode ? 'Developer Mode ON - Click to hide element IDs' : 'Developer Mode OFF - Click to show element IDs'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
                />
              </svg>
            </button>

            <Link
              href="/settings/api-credentials"
              className={`ml-2 p-2 rounded-md transition-colors cursor-pointer ${pathname === '/settings/api-credentials'
                ? 'text-indigo-700 bg-indigo-100'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              title="API & Credential Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </Link>

            {/* User Menu */}
            {session?.user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                      {session.user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <DropdownArrow isOpen={userMenuOpen} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-md shadow-lg border z-50">
                    <div className="px-4 py-3 border-b">
                      <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                      <p className="text-xs text-indigo-600 mt-1 capitalize">{session.user.role || 'user'}</p>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
