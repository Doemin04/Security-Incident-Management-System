import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/db';

interface ThreatCorrelationRow extends RowDataPacket {
  Closed_At: Date | null;
  Created_At: Date;
  Description: string;
  IncidentID: number;
  IOCID: number;
  IOCType: 'IP' | 'Domain' | 'Hash' | 'URL' | 'Email';
  IOCValue: string;
  Severity: 'Low' | 'Medium' | 'High' | 'Critical';
  Status: 'Open' | 'In Progress' | 'Closed' | 'False Positive';
  Title: string;
  TTR: number | null;
}

interface ThreatCampaign {
  IncidentCount: number;
  IOC: {
    IOCID: number;
    Type: ThreatCorrelationRow['IOCType'];
    Value: string;
  };
  Incidents: Array<{
    Closed_At: Date | null;
    Created_At: Date;
    Description: string;
    IncidentID: number;
    Severity: ThreatCorrelationRow['Severity'];
    Status: ThreatCorrelationRow['Status'];
    Title: string;
    TTR: number | null;
  }>;
}

export async function getThreatCampaigns(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<ThreatCorrelationRow[]>(
      `SELECT
         ioc.IOCID,
         ioc.Type  AS IOCType,
         ioc.Value AS IOCValue,
         incident.IncidentID,
         incident.Title,
         incident.Description,
         incident.Status,
         incident.Severity,
         incident.Created_At,
         incident.Closed_At,
         incident.TTR
       FROM (
         SELECT IOCID
         FROM Incident_IOC_Contains
         GROUP BY IOCID
         HAVING COUNT(DISTINCT IncidentID) > 1
       ) shared
       JOIN IndicatorOfCompromise ioc
         ON ioc.IOCID = shared.IOCID
       JOIN Incident_IOC_Contains iic
         ON iic.IOCID = shared.IOCID
       JOIN Incident incident
         ON incident.IncidentID = iic.IncidentID
       ORDER BY ioc.IOCID ASC, incident.Created_At DESC, incident.IncidentID DESC`
    );

    const campaigns = new Map<number, ThreatCampaign>();

    for (const row of rows) {
      let campaign = campaigns.get(row.IOCID);

      if (!campaign) {
        campaign = {
          IncidentCount: 0,
          IOC: {
            IOCID: row.IOCID,
            Type: row.IOCType,
            Value: row.IOCValue,
          },
          Incidents: [],
        };
        campaigns.set(row.IOCID, campaign);
      }

      campaign.Incidents.push({
        Closed_At: row.Closed_At,
        Created_At: row.Created_At,
        Description: row.Description,
        IncidentID: row.IncidentID,
        Severity: row.Severity,
        Status: row.Status,
        Title: row.Title,
        TTR: row.TTR,
      });
      campaign.IncidentCount = campaign.Incidents.length;
    }

    res.status(200).json(Array.from(campaigns.values()));
  } catch (err) {
    console.error('getThreatCampaigns:', err);
    res.status(500).json({ error: 'Failed to fetch threat campaigns.' });
  }
}
