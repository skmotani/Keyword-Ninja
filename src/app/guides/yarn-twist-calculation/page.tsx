'use client';

import Link from 'next/link';

export default function YarnTwistCalculationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/twisting-machines" className="text-indigo-600 hover:underline">Twisting Machines</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">Yarn Twist Calculation</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Yarn Twist Calculation Guide</h1>
          <p className="text-xl text-orange-200 max-w-3xl">
            Master the formulas, units, and calculations essential for optimizing yarn twist 
            in your twisting operations.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <article className="bg-white rounded-xl shadow-md p-8 prose prose-lg max-w-none">
          <h2>Introduction to Yarn Twist</h2>
          
          <p>
            Twist is one of the most fundamental properties of yarn, influencing strength, 
            appearance, hand, and behavior during subsequent processing. Understanding how 
            to calculate, measure, and optimize twist is essential for yarn manufacturers 
            seeking to produce consistent, high-quality products.
          </p>

          <p>
            This guide covers the essential formulas, measurement systems, and practical 
            considerations for calculating and controlling yarn twist in various applications.
          </p>

          <h2>Units of Twist Measurement</h2>

          <h3>Turns Per Meter (TPM)</h3>
          <p>
            The SI-standard unit for twist measurement, TPM represents the number of complete 
            360-degree rotations per meter of yarn length. This unit is widely used in 
            international trade and technical specifications.
          </p>

          <h3>Turns Per Inch (TPI)</h3>
          <p>
            Common in the United States and some traditional textile markets, TPI measures 
            twists per inch of yarn length. To convert between units:
          </p>

          <div className="not-prose my-6 bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-800 mb-4">Conversion Formulas</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>TPM = TPI × 39.37</p>
              <p>TPI = TPM ÷ 39.37</p>
            </div>
          </div>

          <h3>Turns Per Centimeter (TPC)</h3>
          <p>
            Sometimes used for convenience, TPC = TPM ÷ 100.
          </p>

          <h2>Twist Direction</h2>

          <p>
            Twist direction is described as either S-twist or Z-twist based on the visual 
            appearance of the helix:
          </p>

          <ul>
            <li><strong>S-twist:</strong> The twist angle runs from upper left to lower right, like the middle section of the letter S</li>
            <li><strong>Z-twist:</strong> The twist angle runs from upper right to lower left, like the middle section of the letter Z</li>
          </ul>

          <p>
            The choice of twist direction affects yarn behavior and is particularly important 
            in plied yarns, where singles and plying twist are typically opposite to create 
            balanced constructions.
          </p>

          <h2>The Twist Multiplier Concept</h2>

          <h3>Understanding Twist Multiplier</h3>
          <p>
            Twist multiplier (TM) or twist factor (α) is a normalized measure that allows 
            comparison of twist levels across different yarn counts. The same TPM in a fine 
            yarn represents more &quot;twist effect&quot; than in a coarse yarn because the helix 
            angle is greater.
          </p>

          <h3>Twist Multiplier Formulas</h3>

          <div className="not-prose my-6 bg-orange-50 rounded-lg p-6">
            <h4 className="font-semibold text-orange-800 mb-4">For English Count (Ne)</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>TM = TPI ÷ √(Ne)</p>
              <p>TPI = TM × √(Ne)</p>
            </div>
          </div>

          <div className="not-prose my-6 bg-orange-50 rounded-lg p-6">
            <h4 className="font-semibold text-orange-800 mb-4">For Metric Count (Nm)</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>αm = TPM ÷ √(Nm)</p>
              <p>TPM = αm × √(Nm)</p>
            </div>
          </div>

          <div className="not-prose my-6 bg-orange-50 rounded-lg p-6">
            <h4 className="font-semibold text-orange-800 mb-4">For Tex (Direct System)</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>αtex = TPM × √(Tex) ÷ 1000</p>
              <p>TPM = αtex × 1000 ÷ √(Tex)</p>
            </div>
          </div>

          <h2>Calculating Machine Settings</h2>

          <h3>TFO Machine Calculations</h3>
          <p>
            For TFO (Two-For-One) machines, twist is calculated based on the relationship 
            between spindle speed and delivery speed, remembering that TFO inserts two 
            twists per revolution:
          </p>

          <div className="not-prose my-6 bg-blue-50 rounded-lg p-6">
            <h4 className="font-semibold text-blue-800 mb-4">TFO Twist Calculation</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>TPM = (Spindle RPM × 2) ÷ Delivery Speed (m/min)</p>
              <p>Delivery Speed = (Spindle RPM × 2) ÷ TPM</p>
              <p>Spindle RPM = (TPM × Delivery Speed) ÷ 2</p>
            </div>
          </div>

          <h3>Ring Twister Calculations</h3>
          <p>
            For conventional ring twisters (one twist per revolution):
          </p>

          <div className="not-prose my-6 bg-green-50 rounded-lg p-6">
            <h4 className="font-semibold text-green-800 mb-4">Ring Twister Calculation</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>TPM = Spindle RPM ÷ Delivery Speed (m/min)</p>
              <p>Delivery Speed = Spindle RPM ÷ TPM</p>
              <p>Spindle RPM = TPM × Delivery Speed</p>
            </div>
          </div>

          <h2>Practical Calculation Examples</h2>

          <h3>Example 1: TFO Twister Settings</h3>
          <p>
            <strong>Problem:</strong> Calculate the required delivery speed for a TFO machine 
            running at 12,000 RPM to produce yarn with 400 TPM.
          </p>

          <div className="not-prose my-6 bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-800 mb-2">Solution:</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>Delivery Speed = (Spindle RPM × 2) ÷ TPM</p>
              <p>Delivery Speed = (12,000 × 2) ÷ 400</p>
              <p>Delivery Speed = 24,000 ÷ 400</p>
              <p><strong>Delivery Speed = 60 m/min</strong></p>
            </div>
          </div>

          <h3>Example 2: Determining Twist Multiplier</h3>
          <p>
            <strong>Problem:</strong> A 30 Ne cotton yarn has 18 TPI. What is the twist multiplier?
          </p>

          <div className="not-prose my-6 bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-800 mb-2">Solution:</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>TM = TPI ÷ √(Ne)</p>
              <p>TM = 18 ÷ √(30)</p>
              <p>TM = 18 ÷ 5.48</p>
              <p><strong>TM = 3.28</strong></p>
            </div>
          </div>

          <h3>Example 3: Scaling Twist for Different Counts</h3>
          <p>
            <strong>Problem:</strong> If a 20 Ne yarn uses 15 TPI (TM ≈ 3.35), what TPI should 
            be used for 40 Ne yarn to maintain the same twist character?
          </p>

          <div className="not-prose my-6 bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-800 mb-2">Solution:</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>First, calculate TM from the original: TM = 15 ÷ √20 = 3.35</p>
              <p>Then apply to new count: TPI = TM × √(Ne)</p>
              <p>TPI = 3.35 × √(40)</p>
              <p>TPI = 3.35 × 6.32</p>
              <p><strong>TPI ≈ 21.2</strong></p>
            </div>
          </div>

          <h2>Optimal Twist Levels by Application</h2>

          <p>
            Different applications require different twist levels to optimize performance:
          </p>

          <div className="not-prose my-8 overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Application</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Typical TM Range</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-800">Weaving warp</td>
                  <td className="px-4 py-3 text-sm text-gray-600">3.5-4.5</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Higher twist for strength during weaving</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">Weaving weft</td>
                  <td className="px-4 py-3 text-sm text-gray-600">2.8-3.5</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Softer twist for cover and hand</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-800">Knitting</td>
                  <td className="px-4 py-3 text-sm text-gray-600">2.5-3.2</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Low twist for soft hand</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">Sewing thread</td>
                  <td className="px-4 py-3 text-sm text-gray-600">4.0-5.0</td>
                  <td className="px-4 py-3 text-sm text-gray-600">High twist for strength and ply security</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-800">Tire cord</td>
                  <td className="px-4 py-3 text-sm text-gray-600">4.5-6.0</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Maximum strength and fatigue resistance</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">Carpet (cut pile)</td>
                  <td className="px-4 py-3 text-sm text-gray-600">3.5-5.0</td>
                  <td className="px-4 py-3 text-sm text-gray-600">Tuft definition and resilience</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Twist Testing and Measurement</h2>

          <h3>Direct Counting Method</h3>
          <p>
            The most accurate method involves using a twist tester that untwists a measured 
            length of yarn until the fibers are parallel, counting the rotations required. 
            This method accounts for the actual twist in the sample regardless of theoretical 
            calculations.
          </p>

          <h3>Untwist-Retwist Method</h3>
          <p>
            For plied yarns where complete untwisting is difficult, this method untwists 
            until maximum extension, then retwists to the same extension. The counted 
            rotations multiplied by two give the twist level.
          </p>

          <h3>Twist Contraction</h3>
          <p>
            Twist causes yarn contraction – the twisted yarn is shorter than the sum of its 
            component fiber lengths. This contraction affects yarn count and must be 
            accounted for in production planning:
          </p>

          <div className="not-prose my-6 bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-800 mb-4">Twist Contraction Formula</h4>
            <div className="space-y-2 font-mono text-sm">
              <p>Contraction % = (Original Length - Twisted Length) ÷ Original Length × 100</p>
            </div>
            <p className="text-sm text-gray-600 mt-2">Typical contraction ranges from 2-8% depending on twist level and fiber type.</p>
          </div>

          <h2>Troubleshooting Twist Problems</h2>

          <h3>Twist Variation</h3>
          <p>
            Causes include speed fluctuations, tension variations, and mechanical issues. 
            Solutions involve regular machine maintenance, proper tension settings, and 
            consistent operating procedures.
          </p>

          <h3>Unbalanced Twist</h3>
          <p>
            Plied yarns with improper twist ratios may snarl or bias. The plying twist should 
            typically be opposite and approximately equal to the singles twist for balanced 
            construction.
          </p>

          <div className="not-prose mt-12 p-6 bg-orange-50 rounded-xl">
            <h3 className="text-xl font-semibold text-orange-900 mb-4">Precision Twisting Equipment</h3>
            <p className="text-orange-700 mb-4">
              Meera Industries offers twisting machines with precise speed and tension control for consistent twist results.
            </p>
            <Link 
              href="/twisting-machines"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              Explore Twisting Machines
            </Link>
          </div>
        </article>

        {/* Related Links */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <Link href="/guides/what-is-a-tfo-machine" className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
            <span className="text-orange-600 font-medium">What is a TFO Machine? →</span>
          </Link>
          <Link href="/guides/yarn-ballooning-solution" className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
            <span className="text-orange-600 font-medium">Yarn Ballooning Solutions →</span>
          </Link>
          <Link href="/guides/twisting-defects-and-solutions" className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
            <span className="text-orange-600 font-medium">Twisting Defects →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
