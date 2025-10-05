import { ICookie } from '@ulixee/unblocked-specification/agent/net/ICookie';
import type { Logger } from 'pino';
import Hero from '@ulixee/hero';
import { get_page_url, parseHtml } from './scrape_utils';
import { AsyncBlockingQueue} from './async_blocking_queue';
import { v4 as uuidv4 } from 'uuid';
import Semaphore from 'semaphore-async-await'
import { CustomLevelLogger } from 'pino';
import { createTimeoutPromise } from './utils';

export class Cookie {
    cookie : {[key: string]: string};
    constructor(cookie : {[key: string]: string} = {}){
        this.cookie = cookie
    }
}

export class PageArgs {
    number: number;
    jobIds: string[];
    cookie: Cookie;
    constructor(number: number, cookie: Cookie = new Cookie(), jobIds: string[] = []) {
        this.number = number;
        this.jobIds = jobIds;
        this.cookie = cookie;
    }
}
export class JobArgs {
    pageArgs: PageArgs;
    jobid: string;
    constructor(pageArgs: PageArgs, jobid: string) {
        this.pageArgs = pageArgs;
        this.jobid = jobid;
    }
}
export class ScrapeOperation {  
    baseUrl : string
    keywords: string[]
    pageQueue : AsyncBlockingQueue<number>
    cloudNodePort : number
    region : string
    timeout : number
    pagesScraped : number
    pageRange : number[]
    logger : Logger
    outFile : any 
    num_pages : number
    timeoutPromise : any
    timeoutClear : any
    constructor(baseUrl: string, pageRange: number[], cloudNodePort : number, outFile : any, region : string, logger: Logger, timeout : number = 3600, keywords: string = ''){
        this.baseUrl = baseUrl
        this.keywords = keywords ? keywords.split(',').map(k=>k.trim().toLowerCase()).filter(Boolean) : []
        this.pagesScraped = 0
        this.outFile = outFile
        this.region = region
        this.logger = logger
        this.timeout = timeout
        this.num_pages = pageRange[1] - pageRange[0] + 1
        const { promise: timeoutPromise, clear: timeoutClear } = createTimeoutPromise(timeout, 'Timeout');
        this.timeoutPromise = timeoutPromise;
        this.timeoutClear = timeoutClear;
        this.pageRange = pageRange
        this.pageQueue = new AsyncBlockingQueue<number>()
        this.cloudNodePort = cloudNodePort
    }
    /* Helpers */
    assemble_cookie(cookie: Cookie): string {
        return Object.entries(cookie.cookie)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
    }
    get_dict(cookies : ICookie[]): { [key: string]: string } {
        const cookieDict : { [key: string]: string } = {}
        for (let i = 0; i < cookies.length; i++) {
          cookieDict[cookies[i].name] = cookies[i].value;
        }
        return cookieDict
    }

    // Return true when text likely refers to a cloud engineer role.
    // Matches the full phrase "cloud engineer" or both words "cloud" and "engineer" anywhere.
    matchesFilterText(text: string): boolean {
        if (!text) return false;
        const norm = text.toLowerCase();
        // If no keywords provided, do not filter (accept all)
        if (!this.keywords || this.keywords.length === 0) return true;

        // If explicit keywords provided, require any keyword to appear in text
        for (const kw of this.keywords) {
            if (norm.includes(kw)) return true;
        }
        return false;
    }
    
    /*Scraping Logic*/
    async scrape_job_details(hero : Hero, userAgent : string ,jobId : string, pageArgs : PageArgs) : Promise<any> {
        let cookie : {[key: string]:string} = pageArgs.cookie.cookie
        //Original graphql query
        // let query = 'query jobDetails($jobId: ID!, $jobDetailsViewedCorrelationId: String!, $sessionId: String!, $zone: Zone!, $locale: Locale!, $languageCode: LanguageCodeIso!, $countryCode: CountryCodeIso2!, $timezone: Timezone!) {\n  jobDetails(\n    id: $jobId\n    tracking: {channel: "WEB", jobDetailsViewedCorrelationId: $jobDetailsViewedCorrelationId, sessionId: $sessionId}\n  ) {\n    job {\n      sourceZone\n      tracking {\n        adProductType\n        classificationInfo {\n          classificationId\n          classification\n          subClassificationId\n          subClassification\n          __typename\n        }\n        hasRoleRequirements\n        isPrivateAdvertiser\n        locationInfo {\n          area\n          location\n          locationIds\n          __typename\n        }\n        workTypeIds\n        postedTime\n        __typename\n      }\n      id\n      title\n      phoneNumber\n      isExpired\n      expiresAt {\n        dateTimeUtc\n        __typename\n      }\n      isLinkOut\n      contactMatches {\n        type\n        value\n        __typename\n      }\n      isVerified\n      abstract\n      content(platform: WEB)\n      status\n      listedAt {\n        label(context: JOB_POSTED, length: SHORT, timezone: $timezone, locale: $locale)\n        dateTimeUtc\n        __typename\n      }\n      salary {\n        currencyLabel(zone: $zone)\n        label\n        __typename\n      }\n      shareLink(platform: WEB, zone: $zone, locale: $locale)\n      workTypes {\n        label(locale: $locale)\n        __typename\n      }\n      advertiser {\n        id\n        name(locale: $locale)\n        isVerified\n        registrationDate {\n          dateTimeUtc\n          __typename\n        }\n        __typename\n      }\n      location {\n        label(locale: $locale, type: LONG)\n        __typename\n      }\n      classifications {\n        label(languageCode: $languageCode)\n        __typename\n      }\n      products {\n        branding {\n          id\n          cover {\n            url\n            __typename\n          }\n          thumbnailCover: cover(isThumbnail: true) {\n            url\n            __typename\n          }\n          logo {\n            url\n            __typename\n          }\n          __typename\n        }\n        bullets\n        questionnaire {\n          questions\n          __typename\n        }\n        video {\n          url\n          position\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    companyProfile(zone: $zone) {\n      id\n      name\n      companyNameSlug\n      shouldDisplayReviews\n      branding {\n        logo\n        __typename\n      }\n      overview {\n        description {\n          paragraphs\n          __typename\n        }\n        industry\n        size {\n          description\n          __typename\n        }\n        website {\n          url\n          __typename\n        }\n        __typename\n      }\n      reviewsSummary {\n        overallRating {\n          numberOfReviews {\n            value\n            __typename\n          }\n          value\n          __typename\n        }\n        __typename\n      }\n      perksAndBenefits {\n        title\n        __typename\n      }\n      __typename\n    }\n    companySearchUrl(zone: $zone, languageCode: $languageCode)\n    learningInsights(platform: WEB, zone: $zone, locale: $locale) {\n      analytics\n      content\n      __typename\n    }\n    companyTags {\n      key(languageCode: $languageCode)\n      value\n      __typename\n    }\n    restrictedApplication(countryCode: $countryCode) {\n      label(locale: $locale)\n      __typename\n    }\n    sourcr {\n      image\n      imageMobile\n      link\n      __typename\n    }\n    gfjInfo {\n      location {\n        countryCode\n        country(locale: $locale)\n        suburb(locale: $locale)\n        region(locale: $locale)\n        state(locale: $locale)\n        postcode\n        __typename\n      }\n      workTypes {\n        label\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n'
        //Modified query to remove useless fields
        let query = 'query jobDetails($jobId: ID!, $jobDetailsViewedCorrelationId: String!, $sessionId: String!, $zone: Zone!, $locale: Locale!, $languageCode: LanguageCodeIso!, $countryCode: CountryCodeIso2!, $timezone: Timezone!) {\n  jobDetails(\n    id: $jobId\n    tracking: {channel: "WEB", jobDetailsViewedCorrelationId: $jobDetailsViewedCorrelationId, sessionId: $sessionId}\n  ) {\n    job {\n      sourceZone\n      id\n      title\n      phoneNumber\n      isExpired\n      expiresAt {\n        dateTimeUtc\n      }\n      isLinkOut\n      contactMatches {\n        type\n        value\n      }\n      isVerified\n      abstract\n      content(platform: WEB)\n      status\n      listedAt {\n        label(context: JOB_POSTED, length: SHORT, timezone: $timezone, locale: $locale)\n        dateTimeUtc\n      }\n      salary {\n        currencyLabel(zone: $zone)\n        label\n      }\n      shareLink(platform: WEB, zone: $zone, locale: $locale)\n      workTypes {\n        label(locale: $locale)\n      }\n      advertiser {\n        id\n        name(locale: $locale)\n        isVerified\n        registrationDate {\n          dateTimeUtc\n        }\n      }\n      location {\n        label(locale: $locale, type: LONG)\n      }\n      classifications {\n        label(languageCode: $languageCode)\n      }\n      products {\n        branding {\n          id\n          cover {\n            url\n          }\n          thumbnailCover: cover(isThumbnail: true) {\n            url\n          }\n          logo {\n            url\n          }\n        }\n        bullets\n        questionnaire {\n          questions\n        }\n        video {\n          url\n          position\n        }\n      }\n    }\n    companyProfile(zone: $zone) {\n      id\n      name\n      companyNameSlug\n      shouldDisplayReviews\n      branding {\n        logo\n      }\n      overview {\n        description {\n          paragraphs\n        }\n        industry\n        size {\n          description\n        }\n        website {\n          url\n        }\n      }\n      reviewsSummary {\n        overallRating {\n          numberOfReviews {\n            value\n          }\n          value\n        }\n      }\n      perksAndBenefits {\n        title\n      }\n    }\n    companySearchUrl(zone: $zone, languageCode: $languageCode)\n    companyTags {\n      key(languageCode: $languageCode)\n      value\n    }\n    restrictedApplication(countryCode: $countryCode) {\n      label(locale: $locale)\n    }\n  }\n}'
        const headers: {[key: string]: string} = {
            'accept': '*/*',
            'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'content-type': 'application/json',
            'origin': 'https://hk.jobsdb.com',
            'Connection': 'keep-alive',
            'Cookie' : this.assemble_cookie(pageArgs.cookie),
            'priority': 'u=1, i',
            'referer': `https://hk.jobsdb.com/jobs?jobId=${jobId}&type=standard`,
            // Uncomment if needed:
            // 'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            // 'sec-ch-ua-mobile': '?0',
            // 'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'seek-request-brand': 'jobsdb',
            'seek-request-country': 'HK',
            'user-agent': userAgent,
            'x-seek-ec-sessionid': cookie['JobseekerSessionId'] ?? "",
            'x-seek-ec-visitorid': cookie['JobseekerVisitorId'] ?? "",
            'x-seek-site': 'chalice',
        };
        const jsonData = {
            'operationName': 'jobDetails',
            'variables': {
                'jobId':  jobId,
                'jobDetailsViewedCorrelationId': uuidv4(),
                'sessionId': cookie["JobseekerSessionId"] ?? '',
                'zone': 'asia-1',
                'locale': 'en-HK',
                'languageCode': 'en',
                'countryCode': 'HK',
                'timezone': 'America/New_York',
            },
            'query': query
        }
        try{
            const response: any = await hero.fetch(
                'https://hk.jobsdb.com/graphql',
                {
                    method : 'POST',
                    headers: headers,
                    body : JSON.stringify(jsonData)
                }
            );
            if (await response.status !== 200) {
                return [jobId, null, `Error Status ${await response.status} on job fetch for p${pageArgs.number}`];
            }
            const responseJson : any = await response.json()
            responseJson.data.jobDetails.job.content = parseHtml(responseJson.data.jobDetails.job.content)
            return [jobId, responseJson.data.jobDetails, null];
        } catch (e: any) {
            return [jobId, null, e.toString()];
        } 
    }
    async scrape_page_job_details(hero: Hero, semaphore : Semaphore, userAgent : string, pageArgs : PageArgs) : Promise<any> {
        let tasks : any = []
        const writePageObject = async (jobs : any) => {
            let page = {'page' : {'number' : pageArgs.number, jobs}}
            let data = JSON.stringify(page,null,2);
            await this.outFile.writeToFile(data + ",\n");
        }
        const limited_scrape_job_details = async (jobId : string) => {
            let ret : any = []
            try{
                await semaphore.acquire()
                ret = await this.scrape_job_details(hero,userAgent,jobId,pageArgs)
            } catch(error){
                throw error
            } finally {
                semaphore.release()
            }
            return ret
        }
        for (let jobId of pageArgs.jobIds) {
            tasks.push(limited_scrape_job_details(jobId))
        }
        const rets = await Promise.all(tasks);
        const jobs : any = []
        for (const [jobId, jobDetails, err] of rets) {
            if (err) {
                this.logger.error(err)
                return pageArgs
            } else {
                // Combine title and content and apply filter
                const title = jobDetails?.job?.title ?? ''
                const content = jobDetails?.job?.content ?? ''
                const combined = `${title} ${content}`.trim()
                if (this.matchesFilterText(combined)) {
                    const job = {jobId : jobId, jobDetails}
                    jobs.push(job)
                } else {
                    this.logger.debug(`Skipping job ${jobId} - does not match filter`)
                }
            }
        }
        // Only write page if we found matching jobs
        if (jobs.length > 0) {
            await writePageObject(jobs)
        } else {
            this.logger.info(`No matching jobs on page ${pageArgs.number}, skipping write`)
        }
    }
    async startWorker(){
        const hero = new Hero({
            sessionPersistence : false,
            blockedResourceTypes: [
            'All'
            ],
            connectionToCore: {
                host: `localhost:${this.cloudNodePort}`,
            }
        }); 
        let workerPagesScraped = 0
        const userAgent = (await hero.meta).userAgentString
        this.logger.info(`Hero instance started with user agent: ${userAgent}`);
        const concurrency_lim : number = 8
        const semaphore = new Semaphore(concurrency_lim)
        try {
            while(!this.pageQueue.isEmpty()){
                let jobIds : any = []
                const pageNum = await this.pageQueue.dequeue()
                await hero.goto(get_page_url(pageNum,this.region))
                await hero.waitForLoad('DomContentLoaded')
                const article_elems = await hero.querySelectorAll('article[data-job-id]').$detach();
                for (let elem of article_elems) {
                    const jobId = elem.getAttribute('data-job-id')
                    if(jobId !== null){
                        jobIds.push(jobId)
                    }
                }
                const cookie = new Cookie(this.get_dict((await hero.activeTab.cookieStorage.getItems())))
                const pageArgs = new PageArgs(pageNum,cookie,jobIds)
                // this.logger.info(`Starting scrape page operation on ${pageArgs.number}`)
                let ret : any 
                let tries = 0
                do { 
                    tries++
                    if(tries > 1){
                        this.logger.warn(`Retrying scrape page operation on ${pageArgs.number} (attempt ${tries})`)
                    } else {
                        this.logger.info(`Starting scrape page operation on ${pageArgs.number}`)
                    }
                    ret = await this.scrape_page_job_details(hero,semaphore,userAgent,pageArgs)
                } while(ret !== undefined);
                this.pagesScraped++
                workerPagesScraped++
                this.logger.info(`Scraped page ${pageArgs.number}`)
            }
        } catch(err){
            throw err
        } finally {
            await hero.close()
            this.logger.info(`Hero instance with ua ${userAgent} closed, scraped ${workerPagesScraped} pages`);
        }
    }
    /* Partitions the scraping operation into concurrent page ranges */
    async scrape_all_jobs(){
        const tasks : any = []
        try{
            this.logger.info(`Adding pages ${this.pageRange[0]}-${this.pageRange[1]} to queue`)
            for(let i = this.pageRange[0]; i <= this.pageRange[1]; i++){
                this.pageQueue.enqueue(i)
            }
            let heroInstances = Math.min(this.num_pages,10)
            this.logger.info(`Starting ${heroInstances} hero instances`)
            for(let i = 0; i<heroInstances; i++){
                tasks.push(this.startWorker())
            }
            await Promise.all(tasks)
        } catch (err){
            throw err
        } 
    }
    /*Starts the scrape*/
    async __call__() : Promise<number> {
        try {
            this.logger.info(`Starting scrape operation on ${this.pageRange[0]}-${this.pageRange[1]} pages, using cloud node on port ${this.cloudNodePort}`)
            await Promise.race([this.scrape_all_jobs(), this.timeoutPromise]);
        } catch (error) {
            throw error;
        } finally {
            this.timeoutClear();
            if(this.pagesScraped < this.num_pages){
                console.error("\nCouldn't complete scraping operation at this time, try again in ~1min, if still persists, please file an issue on github")
                return -1
            }
        }
        return 0
    }
}