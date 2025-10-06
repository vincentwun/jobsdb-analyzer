import { CorePlugin } from '@ulixee/hero-plugin-utils';
export default class NoSandboxPlugin extends CorePlugin {
    static readonly id = 'NoSandboxPlugin';
    onNewBrowser(browser : any, userConfig: any) {
        // Add necessary flags for running Chromium safely in Docker
        this.browserEngine.launchArguments.push(
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--headless=new',
        );
    }
}