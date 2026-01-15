-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'pending',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mainDomain" TEXT,
    "domains" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "industry" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsClientConfig" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "cfApiToken" TEXT,
    "cfZoneId" TEXT,
    "cfAccountId" TEXT,
    "defaultOgImage" TEXT,
    "robotsTxt" TEXT,
    "gaTrackingId" TEXT,
    "gscPropertyUrl" TEXT,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "requireReview" BOOLEAN NOT NULL DEFAULT true,
    "openaiApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsClientConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsCluster" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsTopic" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "clusterId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "primaryKeyword" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "searchVolume" INTEGER NOT NULL DEFAULT 0,
    "intentType" TEXT,
    "intentScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "topicId" TEXT,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "metaDescription" TEXT,
    "metaKeywords" TEXT,
    "canonicalUrl" TEXT,
    "content" JSONB NOT NULL,
    "structuredData" JSONB,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "internalLinks" JSONB,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "reviewedById" TEXT,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "CmsPageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "thumbnail" TEXT,
    "sections" JSONB NOT NULL,
    "styles" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsClientTemplate" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "customStyles" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CmsClientTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsAsset" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "sourceUrl" TEXT,
    "alt" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPageAsset" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "section" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CmsPageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPublishJob" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "pageId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CmsPublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsSitemap" (
    "id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "lastBuilt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CmsSitemap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CmsClientConfig_clientCode_key" ON "CmsClientConfig"("clientCode");

-- CreateIndex
CREATE UNIQUE INDEX "CmsClientConfig_slug_key" ON "CmsClientConfig"("slug");

-- CreateIndex
CREATE INDEX "CmsCluster_clientCode_idx" ON "CmsCluster"("clientCode");

-- CreateIndex
CREATE UNIQUE INDEX "CmsCluster_clientCode_name_key" ON "CmsCluster"("clientCode", "name");

-- CreateIndex
CREATE INDEX "CmsTopic_clientCode_status_idx" ON "CmsTopic"("clientCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CmsTopic_clientCode_slug_key" ON "CmsTopic"("clientCode", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_topicId_key" ON "CmsPage"("topicId");

-- CreateIndex
CREATE INDEX "CmsPage_clientCode_status_idx" ON "CmsPage"("clientCode", "status");

-- CreateIndex
CREATE INDEX "CmsPage_status_scheduledAt_idx" ON "CmsPage"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_clientCode_slug_key" ON "CmsPage"("clientCode", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPageVersion_pageId_version_key" ON "CmsPageVersion"("pageId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CmsTemplate_slug_key" ON "CmsTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CmsClientTemplate_clientCode_templateId_key" ON "CmsClientTemplate"("clientCode", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPageAsset_pageId_assetId_key" ON "CmsPageAsset"("pageId", "assetId");

-- CreateIndex
CREATE INDEX "CmsPublishJob_clientCode_idx" ON "CmsPublishJob"("clientCode");

-- CreateIndex
CREATE INDEX "CmsPublishJob_status_idx" ON "CmsPublishJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CmsSitemap_clientCode_key" ON "CmsSitemap"("clientCode");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsClientConfig" ADD CONSTRAINT "CmsClientConfig_clientCode_fkey" FOREIGN KEY ("clientCode") REFERENCES "Client"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsCluster" ADD CONSTRAINT "CmsCluster_clientCode_fkey" FOREIGN KEY ("clientCode") REFERENCES "Client"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsTopic" ADD CONSTRAINT "CmsTopic_clientCode_fkey" FOREIGN KEY ("clientCode") REFERENCES "Client"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsTopic" ADD CONSTRAINT "CmsTopic_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "CmsCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_clientCode_fkey" FOREIGN KEY ("clientCode") REFERENCES "Client"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "CmsTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CmsTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageVersion" ADD CONSTRAINT "CmsPageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageVersion" ADD CONSTRAINT "CmsPageVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsClientTemplate" ADD CONSTRAINT "CmsClientTemplate_clientCode_fkey" FOREIGN KEY ("clientCode") REFERENCES "Client"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsClientTemplate" ADD CONSTRAINT "CmsClientTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CmsTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsAsset" ADD CONSTRAINT "CmsAsset_clientCode_fkey" FOREIGN KEY ("clientCode") REFERENCES "Client"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageAsset" ADD CONSTRAINT "CmsPageAsset_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPageAsset" ADD CONSTRAINT "CmsPageAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CmsAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsSitemap" ADD CONSTRAINT "CmsSitemap_clientCode_fkey" FOREIGN KEY ("clientCode") REFERENCES "Client"("code") ON DELETE CASCADE ON UPDATE CASCADE;
