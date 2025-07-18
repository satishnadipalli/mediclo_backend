const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please add a parent/guardian"],
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "not_specified"],
      default: "not_specified",
    },
    photo: {
      url: String,
      public_id: String,
    },
    birthCertificate: {
      url: String,
      public_id: String,
    },
    medicalHistory: {
      type: String,
    },
    diagnosis: {
      type: String,
    },
    allergies: {
      type: [String],
      default: [],
    },
    emergencyContact: {
      name: {
        type: String,
        required: false,
      },
      relation: {
        type: String,
        required: false,
      },
      phone: {
        type: String,
        required: false,
      },
    },
    parentInfo: {
      name: {
        type: String,
        required: [true, "Please add Father name"],
      },
      phone: {
        type: String,
        required: [true, "Please add Father phone"],
      },
      email: {
        type: String,
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          "Please add a valid email Either mothers or Father's email is necessary",
        ],
        required:false
      },
      motherName: {
        type: String,
        required: [true, "Please add parent/guardian name"],
      },
      motherphone : {
        type: String,
        required: [true, "Please add parent/guardian name"],
      },
      photo: {
        url: String,
        public_id: String,
      },
      relationship: {
        type: String,
        enum: ["Father", "Mother", "Guardian", "Other"],
        default: "Guardian",
      },
      address: {
        type: String,
        trim: true,
      },
    },
    aadharCard: {
      url: String,
      public_id: String,
    },
    medicalRecords: [
      {
        url: String,
        public_id: String,
        name: String,
        uploadDate: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    therapistNotes: [
      {
        therapistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        date: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
        },
      },
    ],
    assessments: [
      {
        date: {
          type: Date,
          required: [true, "Please add assessment date"],
        },
        type: {
          type: String,
          required: [true, "Please add assessment type"],
        },
        summary: {
          type: String,
          required: [true, "Please add assessment summary"],
        },
        conductedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        documents: [
          {
            url: String,
            public_id: String,
            name: String,
            uploadDate: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create full name virtual
// PatientSchema.virtual("fullName").get(function () {
//   return `${this.firstName} ${this.lastName}`;
// });

// Calculate age virtual
PatientSchema.virtual("age").get(function () {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for appointments
PatientSchema.virtual("appointments", {
  ref: "Appointment",
  localField: "_id",
  foreignField: "patientId",
  justOne: false,
});

//Virtual for  patient's fullName
// PatientSchema.virtual("fullName").get(function () {
//   return `${this.firstName} ${this.lastName}`;
// });

module.exports = mongoose.model("Patient", PatientSchema);


// [
// {
//   date : "23",
//   paid : false
// },
// {
//   date : "24",
//   paid : false
// }

// ]
// dates.length == 1 :
//   // cureent funciontliy
// dates.length > 1 :
//   for( int i = 0 ; i< dates.length ; i++)
//     // cureent funciontliy by updating with dates[i].date


// 23rd --> no issies

// 23rd 24th -->> 

// {
//   appointment ;1 at 24th date
// }

// {
//   appintemtn 2 23rd date 
// }