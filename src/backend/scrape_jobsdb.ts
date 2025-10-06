import {ScrapeOperation, PageArgs, JobArgs} from './scrape_operation';
import {spawn} from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {createLogger} from './logger';
import type {Logger} from 'pino';
import {waitForPort} from './server';
import { clean_dir,appendFileContent } from './file_io_utils';
import {parseNumPages, parseRegion, parseFormat, parseSaveDir} from './parseArguments';
import {setGracefulCleanup,fileSync, dirSync, dir} from 'tmp';
import { TempFile } from './tempfile';
import { printProgressBar } from './utils';
import { sleep } from './utils';
import {InvalidArgumentError, program} from 'commander';
import { findLastPage, get_base_url } from './scrape_utils';
import { ChildProcessWithoutNullStreams } from 'child_process';

setGracefulCleanup()

//Globals
const enableLogging = process.env.LOG_ENABLED === "true";
let logger = createLogger('client',enableLogging)
if(!enableLogging){
  //ignore deprecation warning 
  process.removeAllListeners('warning');
}
const cloudNodeProcesses: ChildProcessWithoutNullStreams[] = [];
let numCloudNodes : number = 0; 
let pageRanges = [[0,0],[0,0]];
const tmpDir = dirSync({unsafeCleanup: !enableLogging})
const mergedOutFile = new TempFile(fileSync({dir : tmpDir.name}))
const outFiles = Array.from({ length: 2 }, () => new TempFile(fileSync({ dir: tmpDir.name })));

let scrapeOperations : ScrapeOperation[] = [];
let tasks : any = [];
let ports : number[] = [];
const start_time = Date.now()/1000;

async function main(options : any){
  let encountered_error = false;
  const resultsDir = options.saveDir;
  const region = options.region
  const baseUrl = get_base_url(region)
  const numPages = options.numPages
  const maxPages = options.maxPages
  try { 
    if (numPages > 10){
      numCloudNodes = 2
      pageRanges = [[1,Math.trunc(numPages/2)],[Math.trunc(numPages/2)+1,numPages]]
    } else {
      numCloudNodes = 1
      pageRanges[0] = [1,numPages]
    }
    //Start cloudnodes
    for (let i = 0; i < numCloudNodes; i++) {
      // Use the compiled cloudnode JS relative to the running file's __dirname
      const cloudnodePath = path.join(__dirname, 'cloudnode.js');
      const serverProcess = spawn('node', [cloudnodePath, String(i), String(enableLogging)]);
      logger.info(`Starting cloudnode ${i+1}...`);
      cloudNodeProcesses.push(serverProcess);
    }
    //Receive portnums
    for (let i = 0; i < numCloudNodes; i++) {
      ports.push(await waitForPort(cloudNodeProcesses[i]))
      logger.info(`Cloudnode ${i+1} started on port ${ports[i]}`);
    }
    //Start scraping
    for (let i = 0; i < numCloudNodes; i++) {
      scrapeOperations.push(new ScrapeOperation(baseUrl,pageRanges[i],ports[i],outFiles[i],region,logger.child({module: `scrapeOp${i+1}`}), undefined, options.keywords))
      tasks.push(scrapeOperations[i].__call__())
      logger.info(`Scrape operation ${i+1} initialized for pages ${pageRanges[i][0]}-${pageRanges[i][1]}`);
    }
    let scrapeOperationsDone = false
    console.log(`Scraping ${numPages}/${maxPages} available pages of jobs on ${get_base_url(region)}.`)
    logger.info(`Scraping ${numPages}/${maxPages} available pages of jobs on ${get_base_url(region)}.`);
    Promise.all(tasks)
    .catch(err => {
      throw err;
    })
    .finally(() => {
      scrapeOperationsDone = true;
      logger.info('All scrape operations completed.');
    });
    while(!scrapeOperationsDone){
      let pagesScraped = 0
      for(let scrapeOp of scrapeOperations){
        pagesScraped += scrapeOp.pagesScraped
      }
      printProgressBar(pagesScraped,numPages)
      await sleep(1000)
    }
    
  } catch (error : any) {
    encountered_error = true
    if(error.code === 'EACCES'){
      console.error("The specified result directory does not have write permissions.")
      logger.error("The specified result directory does not have write permissions.");
    } else {
      console.error('scrape_jobsdb.ts in main:', error);
      logger.error(`Error during scraping: ${error.message}`);
    }
    
  } finally {
      //Cleanup results
      await mergedOutFile.writeToFile('[\n')
      for (let i = 0; i < numCloudNodes; i++) {
        await appendFileContent(outFiles[i].getFilePath(),mergedOutFile.getFilePath())
        if(cloudNodeProcesses.length>0){
          logger.info(`Shutting down CloudNode ${i+1} on port ${ports[i]}...`);
          if(cloudNodeProcesses[i].kill() === false){
            console.log('Error during CloudNode shutdown');
            logger.error(`Error during CloudNode ${i} shutdown`);
          }
        }
      }
      await mergedOutFile.popLine()
      await mergedOutFile.writeToFile('}\n]')
      if(!encountered_error){
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}_${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
        const resultFileName = `jobsdb-${region}-${numPages}-${formattedDate}.json`
        const resultPath = path.join(resultsDir,resultFileName)
        await mergedOutFile.renameTempFile(resultPath)
        console.log(`\nResult file saved to ${resultPath} in json format.`)
        console.log(`Scrape finished in ${Math.floor(Date.now()/1000 - start_time)} seconds`)
        logger.info(`Result file saved to ${resultPath} in json format.`);
        logger.info(`Scrape finished in ${Math.floor(Date.now()/1000 - start_time)} seconds`);
      }
  }
}
program
  .command('maxPages <region>')
  .description('Find the max number of pages you can scrape for a region')
  .action(async (region) => {
    parseRegion(region);
    const lastPage = await findLastPage(region);
    console.log(`You can scrape up to ${lastPage} pages of jobs`);
  });
program
  .command('scrape', { isDefault: true })
  .description('Scrape job listings')
  .requiredOption('-r, --region <two_letters>', 'hk (Hong Kong) or th (Thailand) (required)', parseRegion)
  .option('-n, --numPages <number>', 'Number of pages to scrape',(option) => {return option},'all')
  // .requiredOption('-f, --format <file_format>', 'csv or json', parseFormat)
  .option('-s, --saveDir <pathToDir>', 'Directory to store results file (optional)', parseSaveDir, './jobsdb_scrape_results')
  .option('-k, --keywords <keywords>', 'Comma-separated keywords to filter jobs', (v) => v, '')
  .action(async (cmdObj) => {
    try {
      const [numPages, maxPages] = await parseNumPages(cmdObj.numPages, cmdObj.region);
      cmdObj.numPages = numPages
      cmdObj.maxPages = maxPages
      await main(cmdObj)
    } catch (error) {
      throw error
    }
  });
//program start
(async () => {
  await program.parseAsync(process.argv);
})();
