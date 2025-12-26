'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const masterItems = [
  { href: '/clients', label: 'Clients' },
  { href: '/competitors', label: 'Competitors' },
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
  { href: '/report/competitors', label: 'Unique Domains' },
  { href: '/report/cluster-intelligence', label: 'Cluster Intelligence' },
  { href: '/report/cluster-intelligence-1', label: 'Cluster Intelligence (URL)' },
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
];

export default function Navbar() {
  const pathname = usePathname();
  const [masterOpen, setMasterOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [seoDataOpen, setSeoDataOpen] = useState(false);
  const [curatedOpen, setCuratedOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);

  const masterRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const seoDataRef = useRef<HTMLDivElement>(null);
  const curatedRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);

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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isMasterActive = masterItems.some(item => pathname === item.href);
  const isReportActive = reportItems.some(item => pathname === item.href);
  const isSeoDataActive = seoDataItems.some(item => pathname === item.href);
  const isCuratedActive = curatedItems.some(item => pathname === item.href);
  const isHubActive = allHubItems.some(item => pathname === item.href) || pathname.startsWith('/twisting-machines') || pathname.startsWith('/compare') || pathname.startsWith('/guides');

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
    <nav className="bg-white shadow-sm border-b">
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

            <Link
              href="/settings/api-credentials"
              className={`ml-4 p-2 rounded-md transition-colors cursor-pointer ${pathname === '/settings/api-credentials'
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
          </div>
        </div>
      </div>
    </nav>
  );
}
