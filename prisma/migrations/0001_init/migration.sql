-- CreateTable
CREATE TABLE "CanonicalProduct" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "strengthCfu" TEXT NOT NULL,
    "strengthUnit" TEXT NOT NULL,
    "strengthType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "aliases" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferRaw" (
    "id" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "query" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" TEXT NOT NULL,

    CONSTRAINT "OfferRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferNormalized" (
    "id" TEXT NOT NULL,
    "rawId" TEXT NOT NULL,
    "canonicalId" TEXT,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferNormalized_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferFinal" (
    "id" TEXT NOT NULL,
    "normalizedId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "mall" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "image" TEXT,
    "isParallelImport" BOOLEAN NOT NULL,
    "formulationDiffers" BOOLEAN NOT NULL,
    "brand" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "shippingFee" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "shippingDays" INTEGER,
    "customsNote" TEXT,
    "matchScore" INTEGER NOT NULL,
    "extractionConfidence" DOUBLE PRECISION NOT NULL,
    "needsReview" BOOLEAN NOT NULL,
    "flags" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferFinal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueue" (
    "id" TEXT NOT NULL,
    "normalizedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CjThemarketCache" (
    "query" TEXT NOT NULL,
    "crawledAt" TIMESTAMP(3) NOT NULL,
    "offers" TEXT NOT NULL,

    CONSTRAINT "CjThemarketCache_pkey" PRIMARY KEY ("query")
);

-- CreateIndex
CREATE INDEX "CanonicalProduct_brand_productName_idx" ON "CanonicalProduct"("brand", "productName");

-- CreateIndex
CREATE INDEX "OfferRaw_query_source_idx" ON "OfferRaw"("query", "source");

-- CreateIndex
CREATE INDEX "OfferNormalized_rawId_idx" ON "OfferNormalized"("rawId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferFinal_normalizedId_key" ON "OfferFinal"("normalizedId");

-- CreateIndex
CREATE INDEX "OfferFinal_country_rank_idx" ON "OfferFinal"("country", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQueue_normalizedId_key" ON "ReviewQueue"("normalizedId");

-- AddForeignKey
ALTER TABLE "OfferNormalized" ADD CONSTRAINT "OfferNormalized_rawId_fkey" FOREIGN KEY ("rawId") REFERENCES "OfferRaw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferNormalized" ADD CONSTRAINT "OfferNormalized_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "CanonicalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferFinal" ADD CONSTRAINT "OfferFinal_normalizedId_fkey" FOREIGN KEY ("normalizedId") REFERENCES "OfferNormalized"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_normalizedId_fkey" FOREIGN KEY ("normalizedId") REFERENCES "OfferNormalized"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

