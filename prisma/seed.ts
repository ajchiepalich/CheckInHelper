import { PrismaClient, SourceStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@highlands.local" },
    update: { role: UserRole.ADMIN, name: "Local Admin" },
    create: {
      email: "admin@highlands.local",
      name: "Local Admin",
      role: UserRole.ADMIN,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@highlands.local" },
    update: { role: UserRole.STAFF, name: "Local Staff" },
    create: {
      email: "staff@highlands.local",
      name: "Local Staff",
      role: UserRole.STAFF,
    },
  });

  const fixtureSources = [
    {
      confluencePageId: "10001",
      title: "Requesting Technology Support",
      sourceUrl:
        "https://highlands.atlassian.net/wiki/spaces/IT/pages/10001/Requesting+Technology+Support",
      spaceId: "1000",
      spaceKey: "IT",
      category: "it-support",
      openaiFileId: "file-mock-1",
      lastKnownVersion: 14,
      contentHash: "seed-hash-10001",
      status: SourceStatus.SYNCED,
    },
    {
      confluencePageId: "10002",
      title: "System Access Requests",
      sourceUrl:
        "https://highlands.atlassian.net/wiki/spaces/IT/pages/10002/System+Access+Requests",
      spaceId: "1000",
      spaceKey: "IT",
      category: "access",
      openaiFileId: "file-mock-2",
      lastKnownVersion: 8,
      contentHash: "seed-hash-10002",
      status: SourceStatus.SYNCED,
    },
    {
      confluencePageId: "10003",
      title: "Rock RMS Overview",
      sourceUrl:
        "https://highlands.atlassian.net/wiki/spaces/MIN/pages/10003/Rock+RMS+Overview",
      spaceId: "2000",
      spaceKey: "MIN",
      category: "ministry-systems",
      openaiFileId: "file-mock-3",
      lastKnownVersion: 21,
      contentHash: "seed-hash-10003",
      status: SourceStatus.SYNCED,
    },
  ];

  for (const source of fixtureSources) {
    const record = await prisma.knowledgeSource.upsert({
      where: {
        confluencePageId_sourceType: {
          confluencePageId: source.confluencePageId,
          sourceType: "EXPLICIT_PAGE",
        },
      },
      update: {
        ...source,
        lastSuccessfulSyncAt: new Date(),
        lastAttemptedSyncAt: new Date(),
        enabled: true,
      },
      create: {
        ...source,
        audience: "staff",
        classification: "internal",
        lastSuccessfulSyncAt: new Date(),
        lastAttemptedSyncAt: new Date(),
        enabled: true,
      },
    });

    await prisma.knowledgeFile.deleteMany({
      where: { knowledgeSourceId: record.id },
    });
    await prisma.knowledgeFile.create({
      data: {
        knowledgeSourceId: record.id,
        openaiFileId: source.openaiFileId,
        contentHash: source.contentHash,
        version: source.lastKnownVersion,
        isActive: true,
      },
    });
  }

  await prisma.syncLock.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  console.log("Seed complete:", { admin: admin.email, staff: staff.email });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
