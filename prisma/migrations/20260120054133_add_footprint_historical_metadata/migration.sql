-- AlterTable
ALTER TABLE "FootprintSurfaceRegistry" ADD COLUMN     "businessImpact" JSONB,
ADD COLUMN     "launchYear" INTEGER,
ADD COLUMN     "technicalName" TEXT;

-- CreateTable
CREATE TABLE "AppProfile" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'primary',
    "appName" TEXT NOT NULL DEFAULT 'Keyword Ninja',
    "tagline" TEXT,
    "punchline" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppLogo" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppLogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppProfile_key_key" ON "AppProfile"("key");

-- CreateIndex
CREATE INDEX "AppLogo_profileId_idx" ON "AppLogo"("profileId");

-- AddForeignKey
ALTER TABLE "AppLogo" ADD CONSTRAINT "AppLogo_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AppProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
