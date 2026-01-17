-- CreateTable
CREATE TABLE "FootprintSurfaceRegistry" (
    "id" TEXT NOT NULL,
    "surfaceKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "importanceTier" TEXT NOT NULL,
    "basePoints" INTEGER NOT NULL DEFAULT 10,
    "defaultRelevanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sourceType" TEXT NOT NULL,
    "searchEngine" TEXT,
    "queryTemplates" JSONB NOT NULL,
    "maxQueries" INTEGER NOT NULL DEFAULT 2,
    "confirmationArtifact" TEXT NOT NULL,
    "presenceRules" JSONB,
    "officialnessRules" JSONB,
    "officialnessRequired" BOOLEAN NOT NULL DEFAULT true,
    "evidenceFields" JSONB,
    "tooltipTemplates" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "industryOverrides" JSONB,
    "geoOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootprintSurfaceRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FootprintSurfaceRegistry_surfaceKey_key" ON "FootprintSurfaceRegistry"("surfaceKey");

-- CreateIndex
CREATE INDEX "FootprintSurfaceRegistry_category_idx" ON "FootprintSurfaceRegistry"("category");

-- CreateIndex
CREATE INDEX "FootprintSurfaceRegistry_importanceTier_idx" ON "FootprintSurfaceRegistry"("importanceTier");

-- CreateIndex
CREATE INDEX "FootprintSurfaceRegistry_enabled_idx" ON "FootprintSurfaceRegistry"("enabled");

-- CreateIndex
CREATE INDEX "FootprintSurfaceRegistry_sourceType_idx" ON "FootprintSurfaceRegistry"("sourceType");
