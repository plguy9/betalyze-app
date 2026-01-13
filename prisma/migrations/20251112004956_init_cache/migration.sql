-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sport" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sport" TEXT NOT NULL,
    "externalId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT,
    "teamId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_sport_externalId_key" ON "Team"("sport", "externalId");

-- CreateIndex
CREATE INDEX "Player_sport_lastName_firstName_idx" ON "Player"("sport", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sport_externalId_key" ON "Player"("sport", "externalId");
