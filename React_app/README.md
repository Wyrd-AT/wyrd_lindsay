# Frontend WYRD-JBT

This repository contains the frontend code for the WYRD-JBT project. It's built using React, TypeScript, TailwindCSS, shadcn/ui and Vite.

The project is a Citrus Test manager, with the following features:
- Register and login using email and password (JWT Authentication)
- Create new Clients with almost one task
- Create new tests for a Client and set the author as 'owner'
- Assign a user executor to the test (only the owner can assign)
- Add stakeholders with read-only access to the test (only the owner can add)
- Change the status of a test (to do, in progress, done, canceled)
- Change the priority of a test (0 to 5, 5 is the highest priority)
- View the test details, including the author, executor, stakeholders
- Visualize the Client board with the tasks order by status and priority
- Visualize the team board with the tests grouped by users

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development purposes.
Please, before running the project, run the backend project in the following repository:

[Backend Silver](https://github.com/jardel-vieira-wyrd/backend-silver)

### Running the Application

1. Clone the repository:
   ```
   git clone https://github.com/Wyrd-AT/wyrd-jbt.git
   cd wyrd-jbt
   ```

2. npm install & npm run dev

3. The application will be available at [localhost:5173](http://localhost:5173)

### Development

The application is set up with hot-reloading, so any changes you make to the source files will automatically update in the browser.

## Project Structure

- `public/`: Contains static assets that are copied to the build folder as-is.
- `src/`: The main source directory for your application code.
  - `api/`: Contains API-related code, such as API calls and configurations.
  - `assets/`: Stores static assets like images, fonts, and ui elements.
  - `blocks/`: Contains blocks of ui elements (like AddTask).
  - `components/`: Contains components constructed with shadcn/ui and blocks.
  - `layouts/`: Contains layout components used across multiple pages.
  - `pages/`: Includes layout and components that represent entire pages or routes.
  - `stores/`: Contains state management logic (using Zustand).
  - `test/`: Includes test setup files and potentially shared test utilities.
  - `utils/`: Houses utility functions and helper modules.
- `App.tsx`: The main entry point for the application.
- Other root files: Configuration files for TypeScript, Vite, Git and npm.

## Available Scripts

In the project directory, you can run:

- `npm run dev`: Runs the app in development mode
- `npm run build`: Builds the app for production
- `npm run preview`: Locally preview the production build
- `npm run test`: Run the tests

## Testing

There are a example of tests in the `src/blocks/__tests__/AddTask.test.tsx` file. 
We use `vitest` to run the tests.

To run the tests, run the following command:

```
npm run test
```

The results will be displayed in the console:

```
 ✓ src/blocks/__tests__/AddTask.test.tsx (1)
   ✓ AddTask (1)
     ✓ renders correctly

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  07:05:40
   Duration  443ms
```
There are a Deprecartion Warning in 'punycode' module.
The version used is punycode@2.3.1, that is not deprecated.
The warning can be ignored.


apagar 

{
  "selector": {
    "table": {
      "$regex": "command"
    }
  },
  "limit": 2000
}


import couchdb
import paho.mqtt.client as mqtt
import threading

COUCHDB_URL = "http://admin:wyrd@127.0.0.1:5984"
DATABASE_NAME = "lindsay-data"
MQTT_BROKER = "127.0.0.1"
MQTT_PORT = 1883
DEFAULT_MQTT_TOPIC = "default_topic"

server = couchdb.Server(COUCHDB_URL)
try:
    db = server[DATABASE_NAME]
except couchdb.http.ResourceNotFound:
    db = server.create(DATABASE_NAME)

mqtt_client = mqtt.Client()
mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
mqtt_client.loop_start()

# dicionário para guardar timers ativos por doc_id
timers = {}

def publish_mqtt(payload, topic, qos, doc):
    if payload is not None:
        mqtt_client.publish(topic, payload, qos=qos)
        print(f"Publicado no MQTT -> Tópico: {topic}, Payload: {payload}")
    else:
        print(f"Documento {doc.get('_id')} não possui payload.")

def timer_mqtt(payload, topic, qos, doc, delay):
    """
    Cria/atualiza um timer para o doc: cancela o anterior (se houver)
    e agenda um novo publish após 'delay' segundos.
    """
    doc_id = doc.get("_id")

    # cancela timer anterior, se existir
    if doc_id in timers:
        timers[doc_id].cancel()

    def _delayed():
        publish_mqtt(payload, topic, qos, doc)
        # remove do dict para liberar memória
        timers.pop(doc_id, None)

    t = threading.Timer(delay, _delayed)
    t.daemon = True
    t.start()
    timers[doc_id] = t

    print(f"[TIMER] Agendado doc {doc_id} em {delay}s -> Tópico: {topic}")

def listen_changes():
    changes = db.changes(feed='continuous', include_docs=True, heartbeat=1000)
    for change in changes:
        doc = change.get("doc")
        if not doc:
            continue

        # ignora origens que não sejam externas
        if doc.get("origin") in ("esp32", "scheduler"):
            continue

        topic = doc.get("topic", DEFAULT_MQTT_TOPIC)
        payload = doc.get("payload")
        qos = doc.get("qos", 0)
        timer_value = doc.get("timer")

        if timer_value is not None:
            # tenta converter timer para inteiro (segundos)
            try:
                delay = int(timer_value)
                timer_mqtt(payload, topic, qos, doc, delay)

                # marca o doc como agendado e evita reprocessar
                doc["scheduled"] = True
                doc["origin"] = "scheduler"
                db.save(doc)

            except (ValueError, TypeError):
                print(f"[ERRO] Timer inválido no doc {doc.get('_id')}: {timer_value}")
        else:
            publish_mqtt(payload, topic, qos, doc)

if _name_ == "_main_":
    listen_changes()