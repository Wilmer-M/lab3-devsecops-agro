package main
import rego.v1

# Regla 1: la imagen base debe declarar una versión fija
deny contains msg if {
	some i
	input[i].Cmd == "from"
	image := input[i].Value[0]
	not contains(image, ":")
	image != "scratch"
	msg := sprintf("La imagen base '%s' no declara etiqueta de versión", [image])
}

deny contains msg if {
	some i
	input[i].Cmd == "from"
	endswith(input[i].Value[0], ":latest")
	msg := "No use la etiqueta :latest en la imagen base"
}

# Regla 2: el contenedor no debe ejecutarse como root
deny contains msg if {
	not usuario_sin_privilegios
	msg := "Defina una instrucción USER distinta de root"
}

usuario_sin_privilegios if {
	some i
	input[i].Cmd == "user"
	input[i].Value[0] != "root"
}

# Regla 3 (Regla propia): Prohibir la directiva ADD en el Dockerfile
deny contains msg if {
	some i
	input[i].Cmd == "add"
	msg := "Prohibido usar ADD; utilice COPY para transferencias explícitas y seguras de archivos locales"
}
