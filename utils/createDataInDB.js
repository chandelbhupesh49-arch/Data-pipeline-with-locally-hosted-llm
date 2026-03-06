// import { prisma } from "./prisma.js";
// import crypto from "node:crypto";

// export async function createDataInDB(unifiedJson, subFolderPath, name) {
//     try {
//         const id = crypto.randomUUID();
//         unifiedJson.general.internal_genics_name.value = id;
//         await prisma.data.create({
//             data: {
//                 id: id,
//                 name: name,
//                 materialData: unifiedJson,
//             },
//         });

//         return true;

//     } catch (err) {
//         console.error(`failed to add into database for file path in ${subFolderPath} , Error :`,err);
//         return false;
//     }

// }

import { prisma } from "./prisma.js";
import crypto from "node:crypto";
import logger from "./logger/logger.js";

export async function createDataInDB(
    unifiedJson,
    subFolderPath,
    name,
    maxRetries = 3
) {
    const id = crypto.randomUUID();
    unifiedJson.general.internal_genics_name.value = id;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await prisma.data.create({
                data: {
                    id,
                    name,
                    materialData: unifiedJson,
                },
            });

            return true; // success

        } catch (err) {
            // console.error(
            //     `Attempt ${attempt} failed for ${subFolderPath}:`,
            //     err.message
            // );
            logger.error(
                `Attempt ${attempt} failed for ${subFolderPath}: ${err.message}`
            );

            // if last attempt, fail
            if (attempt === maxRetries) {
                return false;
            }

            // small delay before retry
            await new Promise(res => setTimeout(res, 200 * attempt));
        }
    }
}

