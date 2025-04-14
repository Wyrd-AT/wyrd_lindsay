import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

// Cria o banco de dados local
export const localDB = new PouchDB('lindsay');

// Instancia o banco remoto (adicione a URL que preferir)
// Exemplo usando a URL remota:
export const cloudDB = new PouchDB("http://admin:wyrd@54.211.31.145:5984/mqtt_data");

localDB.changes({
  since: 'now',
  live: true,
  include_docs: true
}).on('change', change => {
    localDB.replicate.to(cloudDB, { live: false, retry: true })
      .then(() => console.log("Mudanças replicadas para o remoto"))
      .catch(err => console.error("Erro ao replicar mudança:", err));
  }).on('error', err => console.error("Erro no changes listener:", err));

// Função para configurar índices e iniciar a replicação
export async function configureReplication() {
  try {
    // Cria índice para os campos necessários
    await localDB.createIndex({
      index: {
        fields: ['topic', 'payload']
      }
    });
    console.log("Índices criados");
  } catch (err) {
    console.error("Erro ao criar índices:", err);
  }

  // Replicação do remoto para o local
  localDB.replicate.from(cloudDB, { live: true, retry: true })
    .on('complete', info => console.log("Replicação do remoto para local concluída"))
    .on('error', err => console.error("Erro na replicação from:", err));

  // Replicação do local para o remoto
  localDB.replicate.to(cloudDB, { live: true, retry: true })
    .on('complete', info => console.log("Replicação do local para remoto concluída"))
    .on('error', err => console.error("Erro na replicação to:", err));
}
