import { MilvusClient, DataType, FunctionType, SearchResultData, checkCreateCollectionCompatibility } from '@zilliz/milvus2-sdk-node';

export class Client {
    private milvusClient: MilvusClient;
    collection: string;
    // Normal signature with defaults
    constructor(milvusClient: MilvusClient, collection: string) {
        this.milvusClient = milvusClient;
        this.collection = collection;
    }

    // close the connection
    async close() {
        await this.milvusClient.closeConnection();
    }

    async deleteCollection() {
        const response = await this.milvusClient.dropCollection({
            collection_name: this.collection,
        });
        const done = response.code || 0;
        if (done != 0) {
            throw new Error(`Failed to delete collection: ${response.reason}`);
        }
    }

    async insert(data: string[] = []): Promise<number> {
        if (data.length == 0) return 0;
        const response = await this.milvusClient.insert({
            collection_name: this.collection, 
            data: data.map(item => {
                return {'text': item};
            }),
        });

        if (response.status.code != 0) {
            throw new Error(`Failed to insert data: ${response.status.reason}`);
        }
        
        return parseInt(response.insert_cnt);
    }

    async search(query: string, topk: number = 3, dropRatio: number = 0.2): Promise<SearchResultData[]> {
        const response = await this.milvusClient.search({
            collection_name: this.collection, 
            data: [ query ],
            limit: topk,
            params: {'drop_ratio_search': dropRatio},
            anns_field: 'sparse',
        });
        
        if (response.status.code != 0) {
            throw new Error(`Failed to search data: ${response.status.reason}`);
        }   
        
        return response.results;
    }

    // factory method to create a client
    static async createClient(uri: string, token: string, db: string, collection: string): Promise<Client> {
        return new Promise<Client>((resolve, reject) => {
            let client = new MilvusClient({
                address: uri,
                token: token
            });
            client.describeDatabase({ db_name: db }).then(response => {
                // first step: check database exists
                if (response.dbID == 0) {
                    // create a new database
                    console.log(`db ${db} doesn't exist, create it`);
                    return client.createDatabase({
                        db_name: db
                    });
                }
            }).then(response => {
                if (response?.code) {
                    console.error(`failed to create database: ${response.reason}`);
                    reject(response?.reason);
                }
                // second step: use database
                return client.useDatabase({
                    db_name: db,
                });
            }).then(response => {
                if (response?.reason != "") {
                    reject(`can't use database ${db}`);
                }
                // third step: verify collection
                return client.describeCollection({ collection_name: collection })
            }).then(async response => {
                // last step: create collection if it doesn't exist
                if (response?.collectionID === '0') {
                    // create a new collection and initialize a new client
                    const res = await Client.createCollection(client, db, collection);
                    client = new MilvusClient({
                        address: uri,
                        token: token
                    });
                    return client.useDatabase({
                        db_name: db,
                    });
                }
            }).then(response => {
                const done = response?.code || 0;
                if (done == 0) {
                    resolve(new Client(client, collection));
                } else {
                    return client.closeConnection()
                }
            }).then(() => {
                reject(`failed to create collection`);
            }).catch(error => {
                reject(`not able to create collection: ${error}`);
            });
        });
    }

    static async wait4Server(uri: string, token: string, db: string): Promise<void> {
        console.log(`waiting for server at ${uri}`);
        let connected = false;
        while(!connected) {
            try {
                const client = new MilvusClient({
                    address: uri,
                    token: token,
                });
                await client.describeDatabase({ db_name: db });
                connected = true;
            } catch (error) {
                console.log("not ready yet... waiting 3s");
                await sleep(3000);
            }
        }
        console.log(`server at ${uri} is ready`);
    }

    private static async createCollection(client: MilvusClient, db: string, collection: string) {
        try {
            const response = await client.createCollection({
                collection_name: collection,
                schema: [
                    {
                        name: "id",
                        data_type: DataType.Int64,
                        is_primary_key: true,
                        autoID: true,
                    },
                    {
                        name: "text",
                        data_type: "VarChar",
                        enable_analyzer: true,
                        enable_match: true,
                        max_length: 1000,
                    },
                    {
                        name: "sparse",
                        data_type: DataType.SparseFloatVector,
                    },
                ],
                functions: [
                    {
                        name: 'text_bm25_emb',
                        description: 'bm25 function',
                        type: FunctionType.BM25,
                        input_field_names: ['text'],
                        output_field_names: ['sparse'],
                        params: {},
                    },
                ],
                index_params: [
                    {
                        field_name: "sparse",
                        metric_type: "BM25",
                        index_type: "AUTOINDEX",
                    },
                ]
            });
            await client.closeConnection();
            await sleep(3000);
            return response;
        } catch (error ) {
            console.log(`Error creating collection: ${error}`);
            throw error;
        }
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
