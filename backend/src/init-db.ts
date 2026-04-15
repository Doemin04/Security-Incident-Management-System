import mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
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

  `CREATE TABLE IF NOT EXISTS LogEvent (
    LogEventID          INT            NOT NULL AUTO_INCREMENT,
    EventTime           DATETIME       NOT NULL,
    SourceIP            VARCHAR(45)        NULL,
    DestinationIP       VARCHAR(45)        NULL,
    Message             TEXT           NOT NULL,
    RawLine             TEXT           NOT NULL,
    SourceSystem        VARCHAR(100)   NOT NULL,
    SourceAssetID       INT                NULL,
    DestinationAssetID  INT                NULL,
    Ingested_At         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (LogEventID),
    CONSTRAINT fk_logevent_source_asset
      FOREIGN KEY (SourceAssetID) REFERENCES Asset(AssetID)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_logevent_destination_asset
      FOREIGN KEY (DestinationAssetID) REFERENCES Asset(AssetID)
      ON DELETE SET NULL ON UPDATE CASCADE
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

  `CREATE TABLE IF NOT EXISTS Incident_LogEvent_Contains (
    IncidentID   INT            NOT NULL,
    LogEventID   INT            NOT NULL,
    PRIMARY KEY (IncidentID, LogEventID),
    CONSTRAINT fk_ilec_incident
      FOREIGN KEY (IncidentID) REFERENCES Incident(IncidentID)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ilec_logevent
      FOREIGN KEY (LogEventID) REFERENCES LogEvent(LogEventID)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

interface ExistsRow extends RowDataPacket {
  exists_flag: number;
}

async function ensureIndex(
  connection: mysql.Connection,
  tableName: string,
  indexName: string,
  createSql: string
): Promise<void> {
  const [rows] = await connection.query<ExistsRow[]>(
    `SELECT 1 AS exists_flag
     FROM information_schema.statistics
     WHERE table_schema = ?
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [DB_NAME, tableName, indexName]
  );

  if (rows.length > 0) {
    console.log(`  [OK] ${indexName}`);
    return;
  }

  await connection.query(createSql);
  console.log(`  [OK] ${indexName}`);
}

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

    await ensureIndex(
      connection,
      'Asset',
      'idx_asset_ip_address',
      'CREATE INDEX idx_asset_ip_address ON Asset(IP_Address)'
    );

    await ensureIndex(
      connection,
      'LogEvent',
      'idx_log_event_time',
      'CREATE INDEX idx_log_event_time ON LogEvent(EventTime)'
    );

    await ensureIndex(
      connection,
      'LogEvent',
      'idx_log_event_source_ip',
      'CREATE INDEX idx_log_event_source_ip ON LogEvent(SourceIP)'
    );

    await ensureIndex(
      connection,
      'LogEvent',
      'idx_log_event_destination_ip',
      'CREATE INDEX idx_log_event_destination_ip ON LogEvent(DestinationIP)'
    );

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
