import Logger from './logger';

const createClobClient = async (): Promise<null> => {
    Logger.info('CLOB client creation disabled');
    return null;
};

export default createClobClient;
