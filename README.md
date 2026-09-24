# Dos realidades

Ejercicio 02 del curso (DPPI 2026), sobre visión artificial y representación. La idea era tomar una sola cámara y usarla para armar dos maneras completamente distintas de "ver" lo mismo.

**Demo:** https://stmvrphy.github.io/dos-realidades/
**Repo:** https://github.com/Stmvrphy/dos-realidades

## De qué se trata

Hay dos sistemas corriendo al mismo tiempo, con la misma cámara. Ninguno de los dos muestra la imagen de la cámara tal cual — cada uno se queda solo con el dato que le importa y lo dibuja a su manera. Por eso terminan pareciendo dos cosas distintas aunque estén mirando exactamente la misma escena.

**Sistema A — Visión de Manos.** Usa MediaPipe para rastrear la anatomía de las manos en cada frame. En vez de dibujar un esqueleto con líneas, el sistema despoja a la mano de cualquier rasgo reconocible y representa cada articulación únicamente como puntos blancos flotando en la oscuridad, con un tamaño ampliado que los hace parecer constelaciones mínimas. Cuando no hay manos en cuadro, en el centro aparecen unos anillos dorados pulsando, como si la máquina estuviera esperando pacientemente que alguien entre en escena. Mientras corre el temporizador de un minuto, este sistema cuenta cuántas veces suben, bajan o se desplazan las manos, y registra si los dedos se abren, se cierran o permanecen activos.

**Sistema B — Movimiento.** Este no reconoce manos ni figuras humanas: solo compara cada frame con el anterior y detecta dónde varió el brillo en el espacio. Donde algo cambia, nacen partículas cuadradas que conservan una estela visible durante dos segundos antes de desvanecerse. La velocidad del cambio define su color: los movimientos sutiles o lentos se tiñen de azul, las variaciones intermedias se vuelven amarillas, y los gestos rápidos o drásticos se encienden en un rojo intenso.

Al finalizar el minuto, ambos sistemas dialogan en el **Índice de Expresividad Manual (IEM)**, combinando la velocidad de las manos y la intensidad del movimiento para entregarte una lectura técnica de cómo contaste tu historia sin palabras: si fue un relato Pasivo, Contenido, Neutro, Animado o Muy Expresivo.

## Cómo probarlo

El `index.html` no se puede abrir directo con doble clic porque el script usa módulos de JS. Hay que levantar un servidor local desde la carpeta, por ejemplo:

```
python3 -m http.server 8000
```

y entrar a `http://localhost:8000`. Va a pedir permiso de cámara — hay que aceptarlo y apretar el botón "Cámara".

## Reflexión

Frente a la cámara ocurre una sola escena, pero cada sistema encuentra algo distinto en ella. Uno mapea la geometría de las manos y las transforma en nodos y vectores; el otro detecta las variaciones de movimiento y contraste en el espacio. Ninguno está equivocado, pero ninguno puede abarcar la totalidad del gesto.

Langdon Winner explicaba que los artefactos técnicos encarnan formas de ver y ordenar el mundo. Con las computadoras ocurre algo similar: aquello que pueden interpretar de nuestra comunicación depende de la estructura técnica que les hemos dado y de los datos que hemos decidido enseñarles a priorizar.

Merleau-Ponty nos recuerda que el lenguaje no vive solo en la abstracción de las palabras, sino en la encarnación de nuestro cuerpo en el mundo. Extendemos el sentido de lo que decimos a través del movimiento de las manos, proyectando intenciones que trascienden el texto. Los puntos y los flujos ópticos de un algoritmo intentan atrapar esa gesticulación, pero jamás podrán capturar la vivencia del gesto que acompaña a la voz.

Tal vez lo fascinante de construir una tecnología que observa nuestros gestos no sea preguntarnos cuánto logra codificar, sino comenzar a reconocer toda esa dimensión expresiva y humana que, inevitablemente, se le escapa.

## Tecnologías

MediaPipe Pose Landmarker (cargado desde CDN) y Canvas 2D con JavaScript puro, sin frameworks ni build.

---
Noelia Landaburu, Sebastian Urquiza · Ejercicio 02 — Dos realidades · DPPI 2026
