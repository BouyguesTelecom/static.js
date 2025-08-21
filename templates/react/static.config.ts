import {ServerConfig, CONFIG as DEFAULT_CONFIG} from "@bouygues-telecom/staticjs";

const CONFIG: ServerConfig = {
    ...DEFAULT_CONFIG,
    PORT: 1234,
    BUILD_DIR: '_build'
};

export default CONFIG;
