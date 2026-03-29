import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Connect WITHOUT specifying a database so we can create it if it doesn't exist.
const DB_NAME = process.env.DB_NAME ?? 'security_incident_management_system';

const CREATE_TABLES: string[] = [
  // ------------------------------------------------------------------
  // Core entities (no FK dependencies)
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS Incident (
    IncidentID   INT            NOT NULL AUTO_INCREMENT,
    Title        VARCHAR(255)   NOT NULL,
    Description  TEXT           NOT NULL,
    Status       ENUM('Open','In Progress','Closed','False Positive') NOT NULL DEFAULT 'Open',
    Severity     ENUM('Low','Medium','High','Critical')               NOT NULL DEFAULT 'Medium',
    Created_At   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Closed_At    DATETIME           NULL DEFAULT NULL,
    TTR          INT                NULL DEFAULT NULL COMMENT 'Time-to-resolve in minutes',
    PRIMARY KEY (IncidentID)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS Asset (
    AssetID      INT            NOT NULL AUTO_INCREMENT,
    Hostname     VARCHAR(255)   NOT NULL,
    IP_Address   VARCHAR(45)    NOT NULL,
    Source       VARCHAR(255)   NOT NULL,
    PRIMARY KEY (AssetID)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS Analyst (
    AnalystID    INT            NOT NULL AUTO_INCREMENT,
    Name         VARCHAR(255)   NOT NULL,
    Role         VARCHAR(100)   NOT NULL,
    Email        VARCHAR(255)   NOT NULL UNIQUE,
    PRIMARY KEY (AnalystID)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS IndicatorOfCompromise (
    IOCID        INT            NOT NULL AUTO_INCREMENT,
    Type         ENUM('IP','Domain','Hash','URL','Email') NOT NULL,
    Value        VARCHAR(512)   NOT NULL,
    PRIMARY KEY (IOCID)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // ------------------------------------------------------------------
  // Weak entity (depends on Incident)
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS Note (
    IncidentID   INT            NOT NULL,
    NoteID       INT            NOT NULL AUTO_INCREMENT,
    Content      TEXT           NOT NULL,
    Time         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (IncidentID, NoteID),
    INDEX idx_note_id (NoteID),
    CONSTRAINT fk_note_incident
      FOREIGN KEY (IncidentID) REFERENCES Incident(IncidentID)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // ------------------------------------------------------------------
  // Junction tables
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS Incident_Asset_Affects (
    IncidentID   INT            NOT NULL,
    AssetID      INT            NOT NULL,
    PRIMARY KEY (IncidentID, AssetID),
    CONSTRAINT fk_iaa_incident
      FOREIGN KEY (IncidentID) REFERENCES Incident(IncidentID)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_iaa_asset
      FOREIGN KEY (AssetID)    REFERENCES Asset(AssetID)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS Incident_IOC_Contains (
    IncidentID   INT            NOT NULL,
    IOCID        INT            NOT NULL,
    PRIMARY KEY (IncidentID, IOCID),
    CONSTRAINT fk_iic_incident
      FOREIGN KEY (IncidentID) REFERENCES Incident(IncidentID)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_iic_ioc
      FOREIGN KEY (IOCID)      REFERENCES IndicatorOfCompromise(IOCID)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS Incident_Analyst_Assigned (
    IncidentID   INT            NOT NULL,
    AnalystID    INT            NOT NULL,
    PRIMARY KEY (IncidentID, AnalystID),
    CONSTRAINT fk_iaa2_incident
      FOREIGN KEY (IncidentID) REFERENCES Incident(IncidentID)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_iaa2_analyst
      FOREIGN KEY (AnalystID)  REFERENCES Analyst(AnalystID)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function initDb(): Promise<void> {
  // Connect with no database selected so we can create it if it doesn't exist.
  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 3306),
    user:     process.env.DB_USER     ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`[OK] Database '${DB_NAME}' ready.`);

    await connection.query(`USE \`${DB_NAME}\``);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const sql of CREATE_TABLES) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      const tableName = match ? match[1] : 'unknown';
      await connection.query(sql);
      console.log(`  [OK] ${tableName}`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nDatabase initialised successfully.');
  } catch (error) {
    console.error('Failed to initialise database:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

initDb();
