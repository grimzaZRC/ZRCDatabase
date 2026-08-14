/**
 * Sistema de base de datos para Minecraft Bedrock Edition, respaldado por
 * Dynamic Properties. Cachea la tabla en memoria y persiste los cambios
 * fragmentando el JSON en propiedades dinámicas.
 */
declare class BDatabase {
    private tableName: string;
    private QUEUE: Function[];
    private onLoadCallback?: (data: any) => void;

    /**
     * Crea o abre una tabla de la base de datos.
     * @param tableName Nombre único de la tabla.
     */
    constructor(tableName: string);

    /**
     * Borra por completo el almacenamiento persistente de esta tabla
     * y reinicia la caché en memoria a un objeto vacío.
     */
    resetStorage(): void;

    /**
     * Lee y reconstruye los datos de la tabla directamente desde las
     * Dynamic Properties (operación síncrona/bloqueante).
     * @returns El objeto de datos reconstruido.
     */
    fetch(): object;

    /**
     * Registra una tarea en espera de que la tabla termine de cargar.
     * @returns Una promesa que se resuelve cuando la carga finaliza.
     */
    addQueueTask(): Promise<void>;

    /**
     * Persiste el estado actual en memoria a Dynamic Properties,
     * fragmentando el JSON según el límite de tamaño.
     */
    saveData(): Promise<void>;

    /**
     * Ejecuta el callback dado en cuanto la tabla esté cargada
     * (inmediatamente si ya lo está).
     * @param callback Función a invocar con los datos cargados.
     */
    onLoad(callback: (data: any) => void): Promise<void>;

    /**
     * Busca identificadores de Dynamic Properties que compartan el
     * prefijo indicado.
     * @param table Prefijo a buscar.
     * @returns Lista de identificadores encontrados.
     */
    getDBS(table: string): string[];

    /**
     * Asigna un valor a una clave y guarda el cambio.
     * @param key Clave a escribir.
     * @param val Valor a almacenar.
     */
    set(key: string, val: any): Promise<void>;

    /**
     * Asigna múltiples pares clave/valor en una sola operación de guardado.
     * @param data Objeto con las claves y valores a escribir.
     */
    setMany(data: { [key: string]: any }): Promise<void>;

    /**
     * Elimina varias claves de la tabla en una sola operación de guardado.
     * @param keys Claves a eliminar.
     */
    deleteMany(keys: string[]): Promise<void>;

    /**
     * Itera sobre cada par clave/valor de la tabla.
     * @param callback Función ejecutada por cada entrada.
     */
    forEach(callback: (key: string, value: any) => void): BDatabase;

    /**
     * Transforma claves y/o valores de la tabla según el callback,
     * reescribiendo las entradas que cambien.
     * @param callback Función que devuelve el nuevo par [clave, valor], o nada para dejarlo igual.
     */
    map(callback: (key: string, value: any) => [string, any] | undefined): BDatabase;

    /**
     * Obtiene un valor de la caché en memoria (requiere que la tabla ya esté cargada).
     * @param key Clave a leer.
     */
    get(key: string): any;

    /**
     * Igual que `get`, pero espera a que la tabla termine de cargar si aún no lo ha hecho.
     * @param key Clave a leer.
     */
    getSync(key: string): Promise<any>;

    /**
     * Obtiene varios valores desde la caché en memoria.
     * @param keys Claves a leer.
     */
    getMany(keys: string[]): any[];

    /**
     * Igual que `getMany`, pero asegura que la tabla esté cargada primero.
     * @param keys Claves a leer.
     */
    getManySync(keys: string[]): Promise<any[]>;

    /**
     * Lista las claves presentes en la caché en memoria.
     */
    keys(): string[];

    /**
     * Igual que `keys`, esperando la carga de la tabla si es necesario.
     */
    keysSync(): Promise<string[]>;

    /**
     * Lista cruda de claves tomada directamente de la caché en memoria,
     * sin esperar a que la carga termine.
     */
    allKeysP(): string[];

    /**
     * Lista de claves con formato (prefijadas con salto de línea),
     * esperando a que la tabla esté cargada.
     */
    allKeys(): Promise<string[] | undefined>;

    /**
     * Lista los valores presentes en la caché en memoria.
     */
    values(): any[];

    /**
     * Igual que `values`, esperando la carga de la tabla si es necesario.
     */
    valuesSync(): Promise<any[]>;

    /**
     * Indica si una clave existe en la caché en memoria.
     * @param key Clave a comprobar.
     */
    has(key: string): boolean;

    /**
     * Igual que `has`, esperando la carga de la tabla si es necesario.
     * @param key Clave a comprobar.
     */
    hasSync(key: string): Promise<boolean>;

    /**
     * Busca la primera clave cuyo valor coincida con el valor dado.
     * @param value Valor a buscar.
     */
    find(value: number): string | number;

    /**
     * Busca todas las claves cuyo valor coincida con el valor dado.
     * @param value Valor a buscar.
     */
    findMany(value: number): string[] | number[];

    /**
     * Devuelve la tabla completa como objeto (requiere carga previa).
     */
    collection(): { [key: string]: any };

    /**
     * Igual que `collection`, esperando la carga de la tabla si es necesario.
     */
    collectionSync(): Promise<{ [key: string]: any }>;

    /**
     * Elimina una clave de la tabla y guarda el cambio.
     * @param key Clave a eliminar.
     * @returns `true` si la clave existía y fue eliminada.
     */
    delete(key: string): Promise<boolean>;

    /**
     * Vacía por completo la tabla (en memoria y persistida).
     */
    clear(): Promise<void>;

    /**
     * Devuelve la primera clave asociada al valor dado, o `null` si no existe.
     * @param value Valor a buscar.
     */
    getKeyByValue(value: any): string | null;
}

export default BDatabase;
