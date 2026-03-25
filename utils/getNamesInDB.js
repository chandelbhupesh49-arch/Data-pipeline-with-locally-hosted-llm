import { prisma } from "./prisma.js";

// export async function getNamesInDB() {
//     const rows = await prisma.data.findMany({
//         select: { name: true },
//     });

//     const names = rows.map(r => r.name);

//     return names;
// }
export async function getNamesInDB() {
    const rows = await prisma.materials.findMany({
        select: { name: true },
    });

    const names = rows.map(r => r.name);

    return names;
}