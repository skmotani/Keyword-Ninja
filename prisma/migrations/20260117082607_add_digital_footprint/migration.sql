-- CreateTable
CREATE TABLE "FootprintScan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainsRaw" TEXT NOT NULL,
    "hintsRaw" TEXT,
    "settingsJson" JSONB,
    "totalDomains" INTEGER NOT NULL,
    "finishedDomains" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "FootprintScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainScan" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "domainRaw" TEXT NOT NULL,
    "domainNormalized" TEXT NOT NULL,
    "crawlStatus" TEXT,
    "finalUrl" TEXT,
    "httpStatus" INTEGER,
    "crawlDataJson" JSONB,
    "profileJson" JSONB,
    "businessType" TEXT,
    "industry" TEXT,
    "geoScope" TEXT,
    "brandName" TEXT,
    "brandVariants" JSONB,
    "scoreTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreMax" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurfaceResult" (
    "id" TEXT NOT NULL,
    "domainScanId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "surfaceKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "relevance" TEXT,
    "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pointsMax" DOUBLE PRECISION NOT NULL,
    "tooltipWhy" TEXT,
    "tooltipHow" TEXT,
    "tooltipAction" TEXT,
    "evidenceJson" JSONB,
    "queriesUsedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurfaceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FootprintScan_status_idx" ON "FootprintScan"("status");

-- CreateIndex
CREATE INDEX "DomainScan_scanId_idx" ON "DomainScan"("scanId");

-- CreateIndex
CREATE INDEX "DomainScan_domainNormalized_idx" ON "DomainScan"("domainNormalized");

-- CreateIndex
CREATE INDEX "SurfaceResult_domainScanId_idx" ON "SurfaceResult"("domainScanId");

-- CreateIndex
CREATE INDEX "SurfaceResult_surfaceKey_idx" ON "SurfaceResult"("surfaceKey");

-- AddForeignKey
ALTER TABLE "DomainScan" ADD CONSTRAINT "DomainScan_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "FootprintScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurfaceResult" ADD CONSTRAINT "SurfaceResult_domainScanId_fkey" FOREIGN KEY ("domainScanId") REFERENCES "DomainScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
