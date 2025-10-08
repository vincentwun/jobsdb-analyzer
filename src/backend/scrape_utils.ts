import {compile} from 'html-to-text'
import HeroCore from '@ulixee/hero-core';
import { TransportBridge } from '@ulixee/net';
import { ConnectionToHeroCore } from '@ulixee/hero';
import Hero from '@ulixee/hero';

// Summary: Utilities for constructing JobsDB URLs, parsing HTML, and finding the last results page.
export const parseHtml = compile({});
// get_page_url: build a paginated jobs listing URL for a region.
export function get_page_url(page: number, region : string): string {
    return `https://${region}.jobsdb.com/jobs?page=${page}`;
}
// get_base_url: base listing URL for a region.
export function get_base_url(region : string): string {
    return `https://${region}.jobsdb.com/jobs`;
}
// isZeroResults: navigate and detect whether a page has no job cards.
export async function isZeroResults(hero: Hero, page: number, region: string) {
    const { activeTab, document } = hero;
    await activeTab.goto(get_page_url(page, region));
    await activeTab.waitForLoad('DomContentLoaded');
    const elem = document.querySelector('[data-testid="job-card"')
    const hasResults = await elem.$exists;
    return hasResults === false
}
// positionFromLastPage: probe adjacent pages to determine binary-search direction.
async function positionFromLastPage(heroes : Hero[] , page : number, region : string) {
    let tasks = []
    for(let i = 0; i < 2;i++){
        tasks.push(isZeroResults(heroes[i],page+i,region))
    }
    let results = await Promise.all(tasks)
    for (let result of results){
        if (result === undefined) {
            throw new Error("Couldn't parse zero result section")
        }
    }
    let currentPageHasNoResults = results[0]
    let currentPageHasResults = !currentPageHasNoResults
    let pageAfterHasNoResults = results[1]
    if(currentPageHasResults && pageAfterHasNoResults){
       return 'on'
    } 
    if(currentPageHasNoResults){
        return 'after'
    }
    return 'before'
}
// findLastPage: perform a binary search using headless heroes to locate the last results page.
export async function findLastPage(region : string, heroes? : Hero[]){
    let heroCore;
    let selfInit = false
    if(heroes === undefined){
        selfInit = true
        const bridge1 = new TransportBridge();
        const bridge2 = new TransportBridge();
        const connectionToCore1 = new ConnectionToHeroCore(bridge1.transportToCore);
        const connectionToCore2 = new ConnectionToHeroCore(bridge2.transportToCore);
        heroCore = new HeroCore();
        heroCore.addConnection(bridge1.transportToClient);
        heroCore.addConnection(bridge2.transportToClient);
        heroes = [
            new Hero({
                sessionPersistence: false,
                blockedResourceTypes: ['All'],
                connectionToCore: connectionToCore1,
            }),
            new Hero({
                sessionPersistence: false,
                blockedResourceTypes: ['All'],
                connectionToCore: connectionToCore2,
            }),
        ];
    }
    let start = 1
    let end = 1000
    let ret = -1
    while(start <= end){
        let mid = Math.trunc((start + end) / 2)
        let pos = await positionFromLastPage(heroes,mid,region)
        if(pos === 'before'){
            start = mid + 1
        } else if(pos === 'on'){
            ret=mid
            break
        } else {
            end = mid - 1
        }
    }
    if(selfInit){
        for(let hero of heroes){
            await hero.close()
        }
        await heroCore?.close()
    }
    if(ret === -1 || ret < 1){
        ret = -1
    }
    return ret 
}