// Summary: Plugin to add Chromium launch flags suitable for containerized environments.
import { CorePlugin } from '@ulixee/hero-plugin-utils';
export default class NoSandboxPlugin extends CorePlugin {
    static readonly id = 'NoSandboxPlugin';
    // onNewBrowser: push recommended launch arguments for running Chromium in Docker.
    onNewBrowser(browser : any, userConfig: any) {
        this.browserEngine.launchArguments.push(
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--headless=new',
        );
    }
}