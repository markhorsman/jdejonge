# jdejonge
REST API for J. de Jonge BV

# config

create config.json file in root of project:

```json
{
	"api": {
		"version"  	: "1.0.0",
		"name"		: "api-name",
		"username" 	: "username",
		"password" 	: "secret",
	    "port"		: "8080"
	},
	"mssql": {
		"user"		: "dbuser",
		"password"	: "dbpass",
		"server" 	: "named-server-or-ip",
		"database"	: "dbname"
	}
}
```