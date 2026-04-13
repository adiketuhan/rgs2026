import { User, Unit, Billing, Settings, FinanceTransaction, FundRequest, Complaint } from "./types";
import { supabase } from "./lib/supabase";

const TABLES = {
  USERS: "users",
  UNITS: "units",
  BILLINGS: "billings",
  SETTINGS: "settings",
  FINANCES: "finances",
  FUND_REQUESTS: "fund_requests",
  COMPLAINTS: "complaints"
};

const DEFAULT_SETTINGS: Settings = {
  waterBaseRate: 25000,
  waterBaseLimit: 10,
  waterExtraRate: 2500,
  trashRate: 10000,
  dueDay: 10
};

export const db = {
  getSettings: async (): Promise<Settings> => {
    try {
      const { data, error } = await supabase
        .from(TABLES.SETTINGS)
        .select("*")
        .eq("id", "global")
        .single();
      
      if (error) throw error;
      return data as Settings;
    } catch (error) {
      console.error("Error getting settings:", error);
      return DEFAULT_SETTINGS;
    }
  },

  updateSettings: async (settings: Settings) => {
    try {
      const { error } = await supabase
        .from(TABLES.SETTINGS)
        .upsert({ id: "global", ...settings });
      
      if (error) throw error;
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select("*");
      
      if (error) throw error;
      return data as User[];
    } catch (error) {
      console.error("Error getting users:", error);
      return [];
    }
  },

  saveUser: async (user: User) => {
    try {
      const { error } = await supabase
        .from(TABLES.USERS)
        .upsert(user);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error saving user:", error);
    }
  },

  deleteUser: async (id: string) => {
    try {
      const { error } = await supabase
        .from(TABLES.USERS)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  },

  getUnits: async (): Promise<Unit[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLES.UNITS)
        .select("*");
      
      if (error) throw error;
      return data as Unit[];
    } catch (error) {
      console.error("Error getting units:", error);
      return [];
    }
  },

  saveUnit: async (unit: Unit) => {
    try {
      const { error } = await supabase
        .from(TABLES.UNITS)
        .upsert(unit);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error saving unit:", error);
    }
  },

  deleteUnit: async (id: string) => {
    try {
      // Delete unit
      const { error: unitError } = await supabase
        .from(TABLES.UNITS)
        .delete()
        .eq("id", id);
      
      if (unitError) throw unitError;

      // Delete related billings
      const { error: billingError } = await supabase
        .from(TABLES.BILLINGS)
        .delete()
        .eq("unitId", id);
      
      if (billingError) throw billingError;
    } catch (error) {
      console.error("Error deleting unit:", error);
    }
  },

  getBillings: async (): Promise<Billing[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLES.BILLINGS)
        .select("*");
      
      if (error) throw error;
      return data as Billing[];
    } catch (error) {
      console.error("Error getting billings:", error);
      return [];
    }
  },

  saveBilling: async (billing: Billing) => {
    try {
      const { error } = await supabase
        .from(TABLES.BILLINGS)
        .upsert(billing);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error saving billing:", error);
    }
  },

  getFinances: async (): Promise<FinanceTransaction[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLES.FINANCES)
        .select("*");
      
      if (error) throw error;
      return data as FinanceTransaction[];
    } catch (error) {
      console.error("Error getting finances:", error);
      return [];
    }
  },

  saveFinanceTransaction: async (transaction: FinanceTransaction) => {
    try {
      const { error } = await supabase
        .from(TABLES.FINANCES)
        .upsert(transaction);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error saving finance transaction:", error);
    }
  },

  deleteFinanceTransaction: async (id: string) => {
    try {
      const { error } = await supabase
        .from(TABLES.FINANCES)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error deleting finance transaction:", error);
    }
  },

  subscribeFinances: (callback: (transactions: FinanceTransaction[]) => void) => {
    // Initial fetch
    db.getFinances().then(callback);

    // Subscribe to changes
    const channel = supabase
      .channel('public:finances')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.FINANCES }, () => {
        db.getFinances().then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  getFundRequests: async (): Promise<FundRequest[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLES.FUND_REQUESTS)
        .select("*");
      
      if (error) throw error;
      return data as FundRequest[];
    } catch (error) {
      console.error("Error getting fund requests:", error);
      return [];
    }
  },

  saveFundRequest: async (request: FundRequest) => {
    try {
      const { error } = await supabase
        .from(TABLES.FUND_REQUESTS)
        .upsert(request);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error saving fund request:", error);
    }
  },

  subscribeFundRequests: (callback: (requests: FundRequest[]) => void) => {
    // Initial fetch
    db.getFundRequests().then(callback);

    const channel = supabase
      .channel('public:fund_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.FUND_REQUESTS }, () => {
        db.getFundRequests().then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  deleteFundRequest: async (id: string) => {
    try {
      const { error } = await supabase
        .from(TABLES.FUND_REQUESTS)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error deleting fund request:", error);
    }
  },

  getComplaints: async (): Promise<Complaint[]> => {
    try {
      const { data, error } = await supabase
        .from(TABLES.COMPLAINTS)
        .select("*");
      
      if (error) throw error;
      return data as Complaint[];
    } catch (error) {
      console.error("Error getting complaints:", error);
      return [];
    }
  },

  saveComplaint: async (complaint: Complaint) => {
    try {
      const { error } = await supabase
        .from(TABLES.COMPLAINTS)
        .upsert(complaint);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error saving complaint:", error);
    }
  },

  subscribeComplaints: (callback: (complaints: Complaint[]) => void) => {
    db.getComplaints().then(callback);

    const channel = supabase
      .channel('public:complaints')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.COMPLAINTS }, () => {
        db.getComplaints().then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeUnits: (callback: (units: Unit[]) => void) => {
    db.getUnits().then(callback);

    const channel = supabase
      .channel('public:units')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.UNITS }, () => {
        db.getUnits().then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeUsers: (callback: (users: User[]) => void) => {
    db.getUsers().then(callback);

    const channel = supabase
      .channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.USERS }, () => {
        db.getUsers().then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeBillings: (callback: (billings: Billing[]) => void) => {
    db.getBillings().then(callback);

    const channel = supabase
      .channel('public:billings')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.BILLINGS }, () => {
        db.getBillings().then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeSettings: (callback: (settings: Settings) => void) => {
    db.getSettings().then(callback);

    const channel = supabase
      .channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.SETTINGS, filter: 'id=eq.global' }, () => {
        db.getSettings().then(callback);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  testConnection: async () => {
    try {
      const { error } = await supabase.from(TABLES.SETTINGS).select("id").limit(1);
      if (error) throw error;
      console.log("Supabase connection successful");
    } catch (error) {
      console.error("Supabase connection failed:", error);
    }
  }
};
