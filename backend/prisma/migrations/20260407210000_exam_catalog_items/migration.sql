-- CreateTable
CREATE TABLE "exam_catalog_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rolItemCode" TEXT,
    "type" "ComplementaryExamType" NOT NULL,
    "specimenDefault" TEXT,
    "unit" TEXT,
    "referenceRange" TEXT,
    "sourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_catalog_items_code_key" ON "exam_catalog_items"("code");

-- CreateIndex
CREATE INDEX "exam_catalog_items_type_idx" ON "exam_catalog_items"("type");

-- CreateIndex
CREATE INDEX "exam_catalog_items_name_idx" ON "exam_catalog_items"("name");
