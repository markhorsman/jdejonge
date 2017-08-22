# jdejonge API
Custom REST API used for retrieving and mutating data for an Insphire SQL database. 

# config

create config.json file in root of project:

```json
{
	"api": {
		"version"  	: "1.0.0",
		"name"		: "apiname",
		"username" 	: "authusername",
		"password" 	: "authpass",
		"port"		: "8080"
	},
	"mssql": {
		"user"		: "dbuser",
		"password"	: "dbpass",
		"server" 	: "named-sql-server-or-ip",
		"database"	: "dbname"
	}
}
```