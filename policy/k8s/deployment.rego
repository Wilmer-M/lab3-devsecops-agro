package main
import rego.v1

contenedores contains c if {
	input.kind == "Deployment"
	some c in input.spec.template.spec.containers
}

deny contains msg if {
	some c in contenedores
	not c.resources.limits
	msg := sprintf("'%s' debe definir resources.limits", [c.name])
}

deny contains msg if {
	some c in contenedores
	not c.readinessProbe
	msg := sprintf("'%s' debe definir readinessProbe", [c.name])
}

deny contains msg if {
	some c in contenedores
	not c.securityContext.runAsNonRoot
	msg := sprintf("'%s' debe usar runAsNonRoot: true", [c.name])
}

deny contains msg if {
	input.kind == "Deployment"
	input.spec.replicas < 2
	msg := "Un Deployment debe tener al menos 2 réplicas"
}

# Regla propia: Exigir automountServiceAccountToken: false
deny contains msg if {
	input.kind == "Deployment"
	not input.spec.template.spec.automountServiceAccountToken == false
	msg := "El Deployment debe configurar 'automountServiceAccountToken: false' para mitigar exposicion innecesaria del token de ServiceAccount"
}
