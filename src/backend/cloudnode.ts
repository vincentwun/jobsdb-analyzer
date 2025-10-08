// Summary: Launch and manage an Ulixee CloudNode instance, log its port, and handle graceful shutdown.
import { CloudNode } from '@ulixee/cloud';
import NoSandboxPlugin from './NoSandboxPlugin';
import { createLogger } from './logger';
const cloudNodeIndex = parseInt(process.argv[2]);
const enableLogging = process.argv[3] === 'true';
const logger = createLogger(`cloudnode-${cloudNodeIndex}`, enableLogging);

// startCloudNode: create and start a CloudNode, attach NoSandboxPlugin, log its port, and set up shutdown handlers.
async function startCloudNode() {  
  const cloudNode = new CloudNode();
  cloudNode.heroCore.use(NoSandboxPlugin);
  try {
    await cloudNode.listen();
    logger.info(`CloudNode ${cloudNodeIndex} listening on port ${await cloudNode.port}`);
    console.log(await cloudNode.port);
  } catch (error) {
    console.error('ERROR starting Ulixee CloudNode', error);
    logger.error('ERROR starting Ulixee CloudNode\n' + error);
    await cloudNode.close();
    process.exit(1);
  } 
  // shutdown: gracefully close the CloudNode and exit the process with an appropriate code
  const shutdown = async () => {
    try {
      await cloudNode.close();
      logger.info(`CloudNode ${cloudNodeIndex} shut down gracefully.`);
      console.log('CloudNode shut down gracefully...');
      process.exit(0);
    } catch (err) {
      console.error('Error during CloudNode shutdown', err);
      logger.error('Error during CloudNode shutdown\n' + err);
      process.exit(1);
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startCloudNode();
