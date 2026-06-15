-- CreateEnum
CREATE TYPE "ShopName" AS ENUM ('STEPMOTORS', 'CARWORLD');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'counter', 'worker');

-- CreateTable
CREATE TABLE "User" (
    "uuid" UUID NOT NULL,
    "shop_id" "ShopName" NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'worker',
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Session" (
    "session_id" UUID NOT NULL,
    "shop_id" "ShopName" NOT NULL,
    "user_uuid" UUID NOT NULL,
    "device_info" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "uuid" UUID NOT NULL,
    "shop_id" "ShopName" NOT NULL,
    "part_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tags" TEXT,
    "make" TEXT NOT NULL,
    "aed_buying_price" DOUBLE PRECISION DEFAULT 0,
    "ksh_buying_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "selling_price" DOUBLE PRECISION NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Sale" (
    "uuid" UUID NOT NULL,
    "shop_id" "ShopName" NOT NULL,
    "batch_id" TEXT NOT NULL,
    "items_json" TEXT NOT NULL,
    "total_kes" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT NOT NULL,
    "customer_name" TEXT,
    "customer_id" UUID,
    "notes" TEXT,
    "sold_by" UUID NOT NULL,
    "discount_type" TEXT,
    "discount_value" DOUBLE PRECISION,
    "discount_amount" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Customer" (
    "uuid" UUID NOT NULL,
    "shop_id" "ShopName" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "total_purchases" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "CustomerLedgerEntry" (
    "uuid" UUID NOT NULL,
    "shop_id" "ShopName" NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID NOT NULL,

    CONSTRAINT "CustomerLedgerEntry_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Settings" (
    "shop_id" "ShopName" NOT NULL,
    "aed_rate" DOUBLE PRECISION NOT NULL DEFAULT 36.5,
    "conversion_percent" DOUBLE PRECISION NOT NULL DEFAULT 13.0,
    "default_min_stock" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("shop_id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "uuid" UUID NOT NULL,
    "shop_id" "ShopName" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ip_address" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_shop_id_username_key" ON "User"("shop_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_shop_id_part_number_key" ON "InventoryItem"("shop_id", "part_number");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shop_id_phone_key" ON "Customer"("shop_id", "phone");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "User"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sold_by_fkey" FOREIGN KEY ("sold_by") REFERENCES "User"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
