// // // import path from "path";
// // // import { fileURLToPath } from "url";
// // // import fs from "fs/promises";

// // // // __filename

// // // // const __filename = fileURLToPath(import.meta.url);

// // // // console.log(import.meta.url);
// // // // console.log(fileURLToPath(import.meta.url));

// // // const __filename = fileURLToPath(import.meta.url);
// // // const __dirname = path.dirname(__filename);

// // // // console.log(__dirname);

// // // const my_file = path.join(__dirname, "bro.txt");

// // // // console.log(my_file);

// // // // console.log(new Date().toLocaleTimeString());
// // // // const start = Date.now();
// // // // await fs.writeFile(my_file, "Hello file written").then(() => {
// // // //     const timetaken = Date.now() - start;
// // // //     console.log(`done execution in ${timetaken} ms`)
// // // //     console.log(new Date().toLocaleTimeString());
// // // // });

// // // // console.log(new Date().toLocaleTimeString);
// // // // console.log(`done`);

// // // const dat = new Date();
// // // const dat2 = new Date("12-02-2002");

// // // console.log(`${dat}   and   ${dat2}`);



// // // const total = 10;
// // // let current = 0;

// // // function render() {
// // //   const width = 30;
// // //   const filled = Math.round((current / total) * width);
// // //   const bar = "█".repeat(filled) + "░".repeat(width - filled);
// // //   process.stdout.write(`\r${current}/${total} |${bar}|`);
// // // }

// // // const timer = setInterval(() => {
// // //   current++;
// // //   render();
// // //   if (current >= total) {
// // //     clearInterval(timer);
// // //     process.stdout.write("completed\n");
// // //   }
// // // }, 400);


// // // const total = 10;
// // // let current = 0;


// // // const timer = setInterval(()=>{
// // //     current++;

// // //     let width = 30;
// // //     let filled = Math.round((current/total)*width);

// // //     const bar = "█".repeat(filled) + "░".repeat(width - filled);

// // //     process.stdout.write(`\r${current}/${total} ${bar}`);


// // //     if(current >= total){
// // //         clearInterval(timer);
// // //         process.stdout.write(" completed!\n");
// // //     }

// // // },400)

// // // const total = 10;
// // // let current = 0;

// // // const timer = setInterval(() => {
// // //     current++;

// // //     const width = 30;
// // //     const filled = Math.round((current / total) * width);

// // //     const bar = "█".repeat(filled) + "░".repeat(width - filled);
// // //     const line = `${current}/${total} ${bar}`;

// // //     process.stdout.write("\r" + line + ""); // extra spaces wipe trailing leftovers

// // //     if (current >= total) {
// // //         clearInterval(timer);
// // //         process.stdout.write(" completed!\n");
// // //     }
// // // }, 400);

// // // const total = 10;
// // // let current = 0;

// // // process.stdout.write("\x1B[?25l"); // hide cursor

// // // const timer = setInterval(() => {
// // //   current++;

// // //   const width = 60;
// // //   const filled = Math.round((current / total) * width);
// // //   const bar = "█".repeat(filled) + "░".repeat(width - filled);

// // //   process.stdout.clearLine(0);
// // //   process.stdout.cursorTo(0);
// // //   process.stdout.write(`${current}/${total} ${bar}`);

// // //   if (current >= total) {
// // //     clearInterval(timer);
// // //     process.stdout.write(" completed!\n");
// // //     process.stdout.write("\x1B[?25h"); // show cursor back
// // //   }
// // // }, 400);


// // const width = 30;

// // function renderBar(current, total) {
// //     const filled = Math.round((current / total) * width);
// //     return "█".repeat(filled) + "░".repeat(width - filled);
// // }

// // function runBar(label, total, delay = 200) {
// //     return new Promise((resolve) => {
// //         let current = 0;
// //         const timer = setInterval(() => {
// //             current++;

// //             const bar = renderBar(current, total);

// //             // update ONLY the current line
// //             process.stdout.clearLine(0);
// //             process.stdout.cursorTo(0);
// //             if (current < 10) process.stdout.write(`${label} 0${current}/${total} ${bar}`);
// //             else process.stdout.write(`${label} ${current}/${total} ${bar}`)

// //             if (current >= total) {
// //                 clearInterval(timer);
// //                 process.stdout.write(" completed !")
// //                 process.stdout.write("\n \n"); // <-- move to next line and KEEP bar 1
// //                 resolve();
// //             }
// //         }, delay);
// //     });
// // }

// // (async () => {
// //     process.stdout.write("\x1B[?25l"); // hide cursor for nicer UI

// //     await runBar("Processing Akrolen E34:", 10, 200);
// //     await runBar("Processing celenax 3450:", 10, 200);

// //     process.stdout.write("\x1B[?25h"); // show cursor back
// // })();


// import winston from "winston";

// const logger = winston.createLogger({
//     level: 'info',
//     format: winston.format.json(),
//     transports: [
//         //
//         // - Write all logs with importance level of `error` or higher to `error.log`
//         //   (i.e., error, fatal, but not other levels)
//         //
//         new winston.transports.File({ filename: 'error.log', level: 'error' }),
//         //
//         // - Write all logs with importance level of `info` or higher to `combined.log`
//         //   (i.e., fatal, error, warn, and info, but not trace)
//         //
//         new winston.transports.File({ filename: 'combined.log' }),
//     ],
// })

// logger.add(new winston.transports.Console({
//     format: winston.format.combine(
//         winston.format.colorize({ all: true }), // ✅ colors
//         winston.format.timestamp({ format: "HH:mm:ss" }),
//         winston.format.printf(({ timestamp, level, message, ...meta }) => {
//             const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
//             return `${timestamp} ${level}: ${message}${rest}`;
//         })
//     ),
// }));


// logger.log({
//     level: 'info',
//     message: 'Hello distributed log files!'
// });


import fs from "fs";
import path from "path";
import {fileURLToPath} from "node:url";

console.log(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
// console.log(__filename);

const __dirname = path.dirname(__filename);
// console.log(__dirname);

// const inn = path.resolve(__dirname,"./utils","./logger");
// console.log(inn);







