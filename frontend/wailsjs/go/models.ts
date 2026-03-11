export namespace main {
	
	export class Environment {
	    hostname: string;
	    platform: string;
	    architecture: string;
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.platform = source["platform"];
	        this.architecture = source["architecture"];
	    }
	}
	export class BootstrapPayload {
	    environment: Environment;
	
	    static createFrom(source: any = {}) {
	        return new BootstrapPayload(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment = this.convertValues(source["environment"], Environment);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class ChannelConfigField {
	    key: string;
	    label: string;
	    placeholder: string;
	    secret: boolean;
	    required: boolean;

	    static createFrom(source: any = {}) {
	        return new ChannelConfigField(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.placeholder = source["placeholder"];
	        this.secret = source["secret"];
	        this.required = source["required"];
	    }
	}

	export class ChannelInfo {
	    id: string;
	    name: string;
	    displayName: string;
	    installed: boolean;
	    configured: boolean;
	    running: boolean;
	    needsPlugin: boolean;
	    pluginName?: string;

	    static createFrom(source: any = {}) {
	        return new ChannelInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.displayName = source["displayName"];
	        this.installed = source["installed"];
	        this.configured = source["configured"];
	        this.running = source["running"];
	        this.needsPlugin = source["needsPlugin"];
	        this.pluginName = source["pluginName"];
	    }
	}

	export class ConfigSnapshot {
	    configured: boolean;
	    apiBaseUrl: string;
	    apiKey: string;
	    defaultModel: string;
	    defaultProvider: string;

	    static createFrom(source: any = {}) {
	        return new ConfigSnapshot(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configured = source["configured"];
	        this.apiBaseUrl = source["apiBaseUrl"];
	        this.apiKey = source["apiKey"];
	        this.defaultModel = source["defaultModel"];
	        this.defaultProvider = source["defaultProvider"];
	    }
	}
	
	export class InstallerConfig {
	    tag: string;
	    installMethod: string;
	    gitDir: string;
	    noOnboard: boolean;
	    noGitUpdate: boolean;
	    dryRun: boolean;
	    useCnMirrors: boolean;
	    npmRegistry: string;
	    installBaseUrl: string;
	    repoUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tag = source["tag"];
	        this.installMethod = source["installMethod"];
	        this.gitDir = source["gitDir"];
	        this.noOnboard = source["noOnboard"];
	        this.noGitUpdate = source["noGitUpdate"];
	        this.dryRun = source["dryRun"];
	        this.useCnMirrors = source["useCnMirrors"];
	        this.npmRegistry = source["npmRegistry"];
	        this.installBaseUrl = source["installBaseUrl"];
	        this.repoUrl = source["repoUrl"];
	    }
	}
	export class InstallerResult {
	    success: boolean;
	    installedVersion: string;
	    isUpgrade: boolean;
	    message: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallerResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.installedVersion = source["installedVersion"];
	        this.isUpgrade = source["isUpgrade"];
	        this.message = source["message"];
	        this.error = source["error"];
	    }
	}

	export class ModelInfo {
	    id: string;
	    name: string;
	    provider: string;

	    static createFrom(source: any = {}) {
	        return new ModelInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.provider = source["provider"];
	    }
	}

	export class PostInstallActionResult {
	    success: boolean;
	    message: string;
	    error?: string;
	    cancelled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PostInstallActionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.error = source["error"];
	        this.cancelled = source["cancelled"];
	    }
	}

	export class SessionInfo {
	    id: string;
	    title: string;
	    model: string;
	    updatedAt: string;
	    messages: number;

	    static createFrom(source: any = {}) {
	        return new SessionInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.model = source["model"];
	        this.updatedAt = source["updatedAt"];
	        this.messages = source["messages"];
	    }
	}

	export class SessionMessage {
	    role: string;
	    content: string;
	    timestamp?: string;

	    static createFrom(source: any = {}) {
	        return new SessionMessage(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	        this.timestamp = source["timestamp"];
	    }
	}

	export class UpdateInfo {
	    available: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    downloadURL: string;
	    releaseURL: string;

	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.downloadURL = source["downloadURL"];
	        this.releaseURL = source["releaseURL"];
	    }
	}

	export class SimpleResult {
	    success: boolean;
	    message: string;
	    error?: string;

	    static createFrom(source: any = {}) {
	        return new SimpleResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.error = source["error"];
	    }
	}

}
