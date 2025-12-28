'use client';

import Link from 'next/link';
import Image from 'next/image';
import PageHeader from '@/components/PageHeader';

const categories = [
  {
    title: 'Two For One Twister',
    description: 'High-speed TFO technology delivering twice the twist per spindle revolution for maximum productivity.',
    href: '/twisting-machines/tfo-twisters',
    image: '/images/hub/textile_spinning_mac_b187021d.jpg',
    tags: ['Packaging', 'FIBC & Woven Sacks', 'Textile Fabrics'],
    externalLink: 'https://meeraind.com/product/spun-staple-yarn-twister'
  },
  {
    title: 'Ring Twister',
    description: 'Achieve premium quality twisting for technical yarns, ropes, and cords with high-speed, precise control.',
    href: '/twisting-machines/ring-twisters',
    image: '/images/hub/industrial_yarn_spoo_a4002aec.jpg',
    tags: ['Technical Textiles', 'PPMF/Tapes & Twines'],
    externalLink: 'https://meeraind.com/product/ring-twister'
  },
  {
    title: 'TPRS Twister',
    description: 'World\'s first one-step S/Z twisting technology, offering significant savings in cost, labor, & space.',
    href: '/twisting-machines/spun-yarn-twisters',
    image: '/images/hub/textile_spinning_mac_e0e11a82.jpg',
    tags: ['PPMF/Tapes & Twines', 'Technical Textiles', 'Fishnet Industry'],
    externalLink: 'https://meeraind.com/product/tprs-twisters'
  }
];

const industries = [
  {
    title: 'Packaging Materials',
    description: 'High-performance twisting solutions for packaging yarn and reinforcement threads.',
    href: '/twisting-machines/applications/industrial-yarn',
    image: '/images/hub/industrial_yarn_spoo_7565ea41.jpg'
  },
  {
    title: 'Carpet & Rugs',
    description: 'Specialized heat setting and bulking machinery for carpet yarn processing.',
    href: '/twisting-machines/applications/carpet-yarn',
    image: '/images/hub/carpet_manufacturing_5649cc7e.jpg'
  },
  {
    title: 'Technical Textiles',
    description: 'Advanced machinery solutions for high-performance technical textiles.',
    href: '/twisting-machines/applications/rope-cordage',
    image: '/images/hub/rope_cordage_manufac_52827f8c.jpg'
  },
  {
    title: 'Sewing Industry',
    description: 'Reliable machinery for high-quality sewing threads and embroidery yarns.',
    href: '/twisting-machines/applications/embroidery-thread',
    image: '/images/hub/embroidery_thread_co_1f1ff2a7.jpg'
  },
  {
    title: 'Medical Textiles',
    description: 'Precision solutions for surgical sutures and medical-grade yarns.',
    href: '/twisting-machines/applications/medical-suture',
    image: '/images/hub/medical_sutures_surg_2c755785.jpg'
  },
  {
    title: 'Fishing & Marine',
    description: 'Heavy-duty solutions for fishing lines and marine rope manufacturing.',
    href: '/twisting-machines/applications/monofilament',
    image: '/images/hub/monofilament_fishing_3db275be.jpg'
  }
];

const stats = [
  { value: '20-240K', label: 'Denier Range' },
  { value: '39+', label: 'Countries Exported' },
  { value: '100+', label: 'Applications' },
  { value: '80+', label: 'Machine Models' }
];

const guides = [
  { title: 'What is a TFO Machine?', href: '/guides/what-is-a-tfo-machine' },
  { title: 'Yarn Twist Calculation', href: '/guides/yarn-twist-calculation' },
  { title: 'Yarn Ballooning Solutions', href: '/guides/yarn-ballooning-solution' },
  { title: 'Twisting Defects & Solutions', href: '/guides/twisting-defects-and-solutions' }
];

const comparisons = [
  { title: 'TFO vs Ring Twister', href: '/compare/tfo-vs-ring-twister' },
  { title: 'Cabler vs Two-For-One Twister', href: '/compare/cabler-vs-two-for-one-twister' },
  { title: 'TFO Machine: Price vs Output', href: '/compare/tfo-machine-price-vs-output' }
];

export default function TwistingMachinesHub() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <PageHeader title="Twisting Machines Hub" description="Hub page for twisting machines." />
      </div>
      {/* Hero Section - Meeraind Style */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <p className="text-indigo-300 text-sm font-medium tracking-wider uppercase mb-4">
              ISO-Certified Manufacturing Excellence
            </p>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Advanced Twisting, Winding & Bulking Technologies
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Welcome to the World of <span className="text-white font-semibold">SmartPower. SmartOutput. SmartUser.</span> Machines engineered to save energy, boost output, and simplify operation.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://meeraind.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
              >
                Request Custom Quote
              </a>
              <a
                href="https://meeraind.com/#products"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/30 transition-all"
              >
                Explore Our Products
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-slate-50 border-b">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{stat.value}</div>
                <div className="text-slate-600 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product Portfolio */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Product Portfolio</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Twisting, Winding & High Bulking Machines
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            From innovative Two-For-One Twisters to specialized heat setting machines, we deliver complete solutions for modern textile manufacturing.
          </p>
        </div>

        <div className="space-y-8">
          {categories.map((category, index) => (
            <div
              key={category.href}
              className={`group relative bg-slate-50 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                } md:flex`}
            >
              <div className="md:w-1/2 relative h-64 md:h-auto min-h-[300px]">
                <Image
                  src={category.image}
                  alt={category.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="md:w-1/2 p-8 flex flex-col justify-center">
                <div className="flex flex-wrap gap-2 mb-4">
                  {category.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{category.title}</h3>
                <p className="text-slate-600 mb-6">{category.description}</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={category.href}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors"
                  >
                    Learn More
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <a
                    href={category.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                  >
                    View Products
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Industry Applications */}
      <div className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-orange-400 font-medium text-sm uppercase tracking-wider mb-2">Industry Applications</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Specialized Machinery Solutions for Every Industry Need
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From technical textiles to packaging materials, our precision-engineered machinery delivers superior performance across diverse applications.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((industry) => (
              <Link
                key={industry.href}
                href={industry.href}
                className="group relative h-64 rounded-xl overflow-hidden"
              >
                <Image
                  src={industry.image}
                  alt={industry.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{industry.title}</h3>
                  <p className="text-slate-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {industry.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Why Choose Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Why Choose Meera</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Why Global Manufacturers Choose Meera Industries
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
            <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">SmartPower</h3>
            <p className="text-slate-600">
              Intelligent motor controls, lower power per spindle, adaptive power delivery, and real-time energy monitoring. Built to cut energy bills while maintaining performance.
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">SmartOutput</h3>
            <p className="text-slate-600">
              Engineered for maximum production through real-time analytics, precise twist control, optimized bobbin handling, and minimal downtime.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-8 border border-purple-100">
            <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">SmartUser</h3>
            <p className="text-slate-600">
              Designed for effortless operation through intuitive touchscreens, multilingual support, smart alerts, remote diagnostics, and operator-friendly guides.
            </p>
          </div>
        </div>

        {/* Trust Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-slate-900 mb-1">1M+</div>
            <div className="text-slate-600 text-sm">Spindles Sold</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-slate-900 mb-1">1000+</div>
            <div className="text-slate-600 text-sm">Customers Globally</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-slate-900 mb-1">100+</div>
            <div className="text-slate-600 text-sm">Applications</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-slate-900 mb-1">19+</div>
            <div className="text-slate-600 text-sm">Years of Excellence</div>
          </div>
        </div>
      </div>

      {/* Resources Section */}
      <div className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Technical Guides */}
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Technical Guides</h3>
              </div>
              <div className="space-y-3">
                {guides.map((guide) => (
                  <Link
                    key={guide.href}
                    href={guide.href}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-blue-50 transition-colors group"
                  >
                    <span className="text-slate-700 group-hover:text-blue-700 font-medium">{guide.title}</span>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>

            {/* Comparisons */}
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Machine Comparisons</h3>
              </div>
              <div className="space-y-3">
                {comparisons.map((comp) => (
                  <Link
                    key={comp.href}
                    href={comp.href}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-orange-50 transition-colors group"
                  >
                    <span className="text-slate-700 group-hover:text-orange-700 font-medium">{comp.title}</span>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Customised Machines Built Exactly To Your Specs
          </h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            We custom-build fully automated yarn-processing machines—from 20 to 200,000 denier, whether bamboo, silk, carbon, aramid, or any fiber—to your exact specs.
          </p>
          <a
            href="https://meeraind.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Discuss Your Custom Requirements
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
